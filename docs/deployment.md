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
| `DATABASE_URL`     | —      | PostgreSQL connection string                                            |
| `JWT_SECRET`       | —      | Секрет подписи JWT (в prod — случайное длинное значение)                 |
| `PORT`             | `3001` | Порт API (должен совпадать с `destination` rewrites в `next.config.js`) |
| `THROTTLE_TTL_MS`  | `900000` (15 мин) | Окно rate limit для `PATCH /user/password`                     |
| `THROTTLE_LIMIT`   | `5`    | Лимит попыток за окно                                                    |
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

`PATCH /user/password` лимитируется по **user+IP** (ThrottlerGuard с кастомным
tracker). Лимит не должен срабатывать для разных пользователей за одним IP
и для одного пользователя за разными IP — это покрыто e2e-тестами
(`apps/api/test/password.e2e-spec.ts`, оба режима trust proxy).
