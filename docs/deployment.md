# Деплой Meeting AI

## Топология

| Компонент | Приложение | Порт (dev) | Публичный доступ |
| --------- | ---------- | ---------- | ---------------- |
| Web       | Next.js 15 | 3000       | Да (через хостер/CDN) |
| API       | NestJS 10  | 3001       | **Нет** — только через rewrite из Next.js |

Web проксирует `/api/:path*` на `http://localhost:3001/:path*` через rewrites
(`apps/web/next.config.js`). API никогда не должен быть доступен публично
напрямую — только через этот rewrite (или nginx/ALB перед ним).

## Переменные окружения API (`apps/api/.env`)

| Переменная         | Дефолт | Назначение                                                              |
| ------------------ | ------ | ----------------------------------------------------------------------- |
| `DATABASE_URL`     | —      | PostgreSQL connection string (обязательная — иначе API не стартует)     |
| `JWT_SECRET`       | —      | Секрет подписи JWT, **≥ 32 символов** (короче — API падает при старте)   |
| `PORT`             | `3001` | Порт API (должен совпадать с `destination` rewrites в `next.config.js`) |
| `CORS_ORIGINS`     | `http://localhost:3000,http://127.0.0.1:3000` | Разрешённые origins (через запятую); вместо `*` |
| `THROTTLE_TTL_MS`  | `900000` (15 мин) | Окно rate limit для `PATCH /user/password`                     |
| `THROTTLE_LIMIT`   | `5`    | Лимит попыток за окно (register/login — per IP, password — per user+IP) |
| `TRUST_PROXY_HOPS` | `0`    | Хопы reverse proxy (см. ниже)                                            |

Образец — `apps/api/.env.example`.

## `TRUST_PROXY_HOPS` — когда и какое значение

`TRUST_PROXY_HOPS` управляет `app.set('trust proxy', ...)`: сколько прокси-хопов
перед API должен учитывать Express, чтобы брать реальный IP клиента из
`X-Forwarded-For`. От него зависит IP-компонента rate limit `user+IP`.

| Режим доступа к API                              | Значение | Что происходит                                                              |
| ------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| **Прямой доступ** (клиенты ходят на API напрямую) | `0` (или не задано) | trust proxy выключен: `req.ip` = socket-IP клиента, подделка `X-Forwarded-For` не влияет на лимит |
| **За одним прокси** (Next.js rewrite, nginx, ALB) | `1` | Express берёт IP клиента из `X-Forwarded-For`, IP-компонента лимита корректна |
| **За N прокси**                                  | `N`      | N — количество прокси-хопов перед API                                        |

### Правила

- **Прямой доступ → `TRUST_PROXY_HOPS=0`** (дефолт, можно не задавать). Если API
  доступен напрямую, а `TRUST_PROXY_HOPS > 0`, клиент подделывает
  `X-Forwarded-For` и IP-компонента лимита обесценивается (per-user лимит
  сохраняется).
- **Только через rewrite/прокси → `TRUST_PROXY_HOPS>=1`**. Если API доступен
  только через Next.js rewrite (`localhost:3001`), а `TRUST_PROXY_HOPS` не
  задан — все клиенты видны с одним `req.ip` (IP Next.js-сервера),
  IP-компонента лимита схлопывается до per-user (per-user лимит работает).
- Значение = количество прокси-хопов между клиентом и API. Для одного nginx
  или одного Next.js rewrite — `1`.

## Миграции БД

```bash
npm run build:api && npx prisma migrate deploy -w apps/api
```

## Rate limit

- `POST /auth/register` и `POST /auth/login` лимитируются по **IP**
  (стандартный `ThrottlerGuard`, NFR-13: ≤ `THROTTLE_LIMIT` / `THROTTLE_TTL_MS`).
- `PATCH /user/password` лимитируется по **user+IP** (ThrottlerGuard с кастомным
  tracker, лимит зафиксирован `@Throttle` на роуте — `≤ 5 / 15 мин`).
  Лимит не должен срабатывать для разных пользователей за одним IP
  и для одного пользователя за разными IP — это покрыто e2e-тестами
  (`apps/api/test/password.e2e-spec.ts`, оба режима trust proxy).

### Storage: in-memory (ограничение при горизонтальном масштабировании)

`ThrottlerModule.forRoot` (`apps/api/src/app.module.ts`) использует **storage по
умолчанию — in-memory `Map`** в процессе приложения. Это корректно для **одного
инстанса API**, но при **горизонтальном масштабировании** (несколько реплик
API за балансировщиком) счётчики лимитов не общие:

| Инстансы | Что происходит |
| -------- | -------------- |
| 1 | Лимит `THROTTLE_LIMIT` за `THROTTLE_TTL_MS` — глобальный, строгий. |
| N > 1 | Каждый инстанс ведёт **свой** счётчик: эффективный лимит ≈ `N × THROTTLE_LIMIT`, окно стартует отдельно на каждом инстансе, ретраи одного и того же запроса могут попасть на разные реплики. |

**План перехода на shared storage** (когда понадобится горизонтальное
масштабирование):

1. Подключить shared backend (например Redis) и имплементацию
   `ThrottlerStorage` для него (сообщество `@nestjs/throttler` — пакеты вида
   `@nest-lab/throttler-storage-redis` или собственная реализация интерфейса
   `ThrottlerStorage`: `increment(key, ttl, limit, blockDuration, throttlerName)`).
2. Передать storage в `ThrottlerModule.forRoot` через опцию `storage` —
   guard/tracker и поведение лимитов не меняются, меняется только бэкенд
   счётчиков.
3. Настроить env: `THROTTLE_STORAGE=memory|redis`, `REDIS_URL`.
4. Обновить этот раздел и таблицу env в `apps/api/.env.example`.

До горизонтального масштабирования менять storage **не требуется**.

## Кэширование аватаров

`GET /user/profile/avatar` (`apps/api/src/user/user.controller.ts`) отдаёт аватар
с `Cache-Control: private, max-age=31536000, immutable` +
`Vary: Authorization` + `ETag` + `X-Content-Type-Options: nosniff`. На
`If-None-Match`, совпадающий с `ETag` (ключ — size+mtime файла), API отвечает
`304 Not Modified` без тела.

### Почему это безопасно

Аватар — приватный ресурс пользователя. Утечки нет, потому что:

1. `private` запрещает общим кэшам и CDN сохранять ответ.
2. `Vary: Authorization` обязывает любой общий кэш различать ответы по
   заголовку авторизации — ответ пользователя A не будет выдан пользователю B.
3. `ETag` содержит только размер и mtime файла — никакой информации о
   пользователе, `304` не несёт контента.

### Почему не `no-store`

Раньше использовался `no-store`: при таком кэше каждый рендер аватара (шапка
на каждой странице, профиль) ходил в сеть. Теперь `immutable` + `max-age` на год
позволяют браузеру не ходить в сеть, пока не изменится `?v=`-ключ.

### Версия аватара

Клиент ходит через `fetch()` + blob URL с JWT (`?v=${avatarVersion}`) и
инкрементит `avatarVersion` при upload/delete (`auth-context.tsx`). Запросы к
аватару дедуплицируются между инстансами (header + profile) через module-level
кэш промисов (`apps/web/src/components/user-avatar.tsx`). Смена версии ломает
кэш браузера, поэтому после upload/delete браузер заново скачает аватар.

## Инвалидация JWT при смене пароля

`User.tokenVersion` — текущая версия токена пользователя. При `sign`
(`register`/`login`) она кладётся в payload; `JwtStrategy.validate` сверяет её
с БД на каждом запросе и при несовпадении возвращает 401. `PATCH /user/password`
инкрементирует `tokenVersion` — все ранее выданные JWT мгновенно становятся
недействительными. Фронтенд после смены пароля автоматически перелогинивается
(`apps/web/src/components/profile/password-section.tsx`), иначе пришлось бы
входить заново.
