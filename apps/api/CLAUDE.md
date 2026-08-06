# API — NestJS Backend

## Stack

- **NestJS** 10 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
- Express under the hood
- TypeScript 5.4
- **Build tool**: NestJS CLI (`nest build`)

## Скрипты

```bash
npm run dev       # nest start --watch  (hot reload)
npm run build     # nest build
npm run start     # nest start
npm run lint      # eslint src/**/*.ts
```

Из корня monorepo:

```bash
npm run dev:api   # npm run dev -w apps/api
npm run build:api # npm run build -w apps/api
```

## Структура

```
apps/api/
├── prisma/
│   ├── schema.prisma         # схема БД (User с name/avatarStoragePath/avatarMimeType, Meeting, MeetingFile)
│   └── migrations/           # миграции Prisma
├── src/
│   ├── main.ts               # точка входа, создание Nest-приложения (trust proxy, CORS, ValidationPipe)
│   ├── app.module.ts         # корневой модуль
│   ├── prisma/               # PrismaModule (глобальный, @Global())
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/                 # модуль аутентификации (CQRS + Events)
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── commands/
│   │   │   ├── register.command.ts
│   │   │   └── register.handler.ts
│   │   ├── queries/
│   │   │   ├── login.query.ts
│   │   │   └── login.handler.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── user/                 # модуль пользователей (CQRS + Events)
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── guards/
│   │   │   └── change-password-throttler.guard.ts  # rate limit по user+IP для PATCH /user/password
│   │   ├── commands/
│   │   │   ├── update-user-profile.command.ts
│   │   │   └── update-user-profile.handler.ts
│   │   ├── queries/
│   │   │   ├── get-user-profile.query.ts
│   │   │   └── get-user-profile.handler.ts
│   │   └── events/
│   │       ├── user-registered.event.ts
│   │       ├── user-registered.handler.ts
│   │       ├── user-logged-in.event.ts
│   │       └── user-logged-in.handler.ts
│   ├── meetings/             # модуль встреч (Service + Controller)
│   │   ├── meeting.module.ts
│   │   ├── meeting.controller.ts
│   │   ├── meeting.service.ts
│   │   └── dto/
│   │       └── create-meeting.dto.ts
│   └── common/               # общие утилиты
│       ├── decorators/
│       │   └── user-id.decorator.ts
│       ├── filters/
│       │   └── all-exceptions.filter.ts
│       └── utils/
│           ├── cors.util.ts           # resolveCorsOrigins — allowlist из CORS_ORIGINS
│           ├── file-name.util.ts
│           ├── jwt-secret.util.ts     # resolveJwtSecret — JWT_SECRET ≥ 32 символов (fail-fast)
│           ├── profile-mapper.util.ts  # единый маппинг профиля (toProfile) для UserService и GetMeHandler
│           ├── trust-proxy.util.ts     # resolveTrustProxyHops — хопы reverse proxy (по умолчанию 0)
│           └── uuid.util.ts            # isUuid — валидация UUID до формирования путей на диске
├── test/                     # E2E тесты
│   ├── test-env.ts           # ensureTestJwtSecret (≥32) + поднятие THROTTLE_LIMIT
│   ├── auth.e2e-spec.ts
│   ├── meetings.e2e-spec.ts
│   ├── files.e2e-spec.ts
│   ├── user-avatar.e2e-spec.ts
│   ├── password.e2e-spec.ts  # смена пароля + rate limit (user+IP)
│   └── jest-e2e.json
├── nest-cli.json
├── tsconfig.json
└── package.json
```

## CQRS

Проект использует `@nestjs/cqrs` для модулей со сложной бизнес-логикой (auth, user). Модули с простым CRUD используют напрямую `Service` (meetings).

### Когда использовать CQRS

- **CQRS** — если операция требует валидации, проверок, побочных эффектов, интеграции с внешними сервисами (auth: регистрация с хешированием пароля + генерация JWT; user: профиль с валидацией).
- **Service** — если операция сводится к прямому CRUD (meetings: create/read с одним Prisma-запросом).

### Паттерн CQRS + Events (межмодульное взаимодействие)

```
Auth: Controller → CommandBus → Handler → Prisma + EventBus.publish()
User: EventBus → EventHandler → UserService → Prisma
```

Модули общаются через **EventBus** — Auth публикует события (`UserRegisteredEvent`, `UserLoggedInEvent`), User подписывается и реагирует.

| Событие               | Публикует  | Подписчик  | Действие               |
| --------------------- | ---------- | ---------- | ---------------------- |
| `UserRegisteredEvent` | AuthModule | UserModule | Логирование, аналитика |
| `UserLoggedInEvent`   | AuthModule | UserModule | Логирование, аналитика |

### Паттерн CQRS ( Commands + Queries )

```
Controller → CommandBus / QueryBus → Handler → Prisma
```

| Слой       | Файл                                | Назначение                                                        |
| ---------- | ----------------------------------- | ----------------------------------------------------------------- |
| DTO        | `dto/register.dto.ts`               | Валидация входящих данных (`class-validator`)                     |
| Command    | `commands/register.command.ts`      | Plain class с `public readonly` полями                            |
| Handler    | `commands/register.handler.ts`      | `@CommandHandler(RegisterCommand)`, implements `ICommandHandler`  |
| Query      | `queries/login.query.ts`            | Plain class                                                       |
| Handler    | `queries/login.handler.ts`          | `@QueryHandler(LoginQuery)`, implements `IQueryHandler`           |
| Event      | `events/user-registered.event.ts`   | Plain class с данными события                                     |
| Handler    | `events/user-registered.handler.ts` | `@EventsHandler(UserRegisteredEvent)`, implements `IEventHandler` |
| Module     | `auth.module.ts`                    | Импортирует `CqrsModule`, регистрирует хендлеры в `providers`     |
| Controller | `auth.controller.ts`                | Инжектит `CommandBus` и `QueryBus`, вызывает `.execute()`         |

**Command** — мутирующая операция (CUD). Именуется глаголом: `RegisterCommand`.
**Query** — читающая операция (R). Именуется существительным: `LoginQuery`.
**Event** — уведомление о произошедшем событии. Именуется существительным + `Event`: `UserRegisteredEvent`.

Хендлеры декорируются `@CommandHandler()` / `@QueryHandler()` / `@EventsHandler()` и регистрируются как `providers` в модуле. Контроллер не знает о конкретном хендлере — он отправляет команду/запрос через шину (`CommandBus.execute`, `QueryBus.execute`).

### Разделение Auth и User

- **AuthModule** — credentials, JWT, guards. Отвечает за: register, login, JWT strategy, guards.
- **UserModule** — профиль пользователя. Отвечает за: get/update profile. Слушает события Auth через EventBus.
- Auth **не импортирует** UserModule — связь через EventBus (декаплинг).

### Паттерн Service (на примере meetings)

```
Controller → Service → Prisma
```

Простой CRUD без шины: контроллер вызывает методы сервиса напрямую.

## Rate limiting

`POST /auth/register` и `POST /auth/login` защищены `@UseGuards(ThrottlerGuard)`
(NFR-13: ≤ 5 попыток / 15 мин per IP). `PATCH /user/password` защищён
`@UseGuards(ChangePasswordThrottlerGuard)` — кастомный `ThrottlerGuard`, у которого
`getTracker` переопределён на `user.sub + ip` (≤ 5 попыток / 15 мин per user+IP,
лимит зафиксирован `@Throttle`). Один и тот же IP не блокирует других
пользователей, и наоборот. Конфигурация:

| Env | Дефолт | Назначение |
| --- | ------ | ---------- |
| `THROTTLE_TTL_MS` | `900000` (15 мин) | Окно rate limit |
| `THROTTLE_LIMIT` | `5` | Лимит попыток за окно |
| `TRUST_PROXY_HOPS` | `0` (trust proxy выключен) | Хопы reverse proxy (`app.set('trust proxy', ...)`). Выставляется **явно** в prod, если API стоит за прокси |

`ThrottlerModule.forRoot` в `app.module.ts` использует **in-memory storage** (`Map` в процессе) — корректно для одного инстанса, но при горизонтальном масштабировании счётчики не общие (эффективный лимит ≈ N × limit). Ограничение и план перехода на shared storage (Redis) — `docs/deployment.md` → «Rate limit».

### Требование к деплою (trust proxy)

Полная инструкция — `docs/deployment.md` и образец `apps/api/.env.example`.

- **trust proxy по умолчанию выключен** (`TRUST_PROXY_HOPS` не задан / равен `0`): `req.ip` — реальный socket-IP клиента, подделка `X-Forwarded-For` не влияет на rate limit. Используется при **прямом доступе** к API.
- API в production должен быть доступен **только через reverse proxy** (Next.js rewrite, nginx, ALB и т.п.). Если API доступен напрямую, а `TRUST_PROXY_HOPS > 0`, клиент подделывает `X-Forwarded-For` и IP-компонента лимита (`user+IP`) обесценивается (per-user лимит сохраняется).
- **За прокси/rewrite** (в т.ч. единственный доступ через Next.js rewrite `localhost:3001`) задай `TRUST_PROXY_HOPS` = количество прокси-хопов: `1` для одного nginx или одного Next.js rewrite, `N` — для N хопов. Если API за rewrite, а `TRUST_PROXY_HOPS` не задан — все клиенты делят один `req.ip`, IP-компонента лимита схлопывается до per-user (per-user лимит работает). Не включай `trust proxy` без прокси перед API.

## Кэширование аватаров

`GET /user/profile/avatar` отдаёт `Cache-Control: private, max-age=31536000,
immutable` + `Vary: Authorization` + `ETag` (ключ — size+mtime) + `304 Not
Modified` на `If-None-Match` + `X-Content-Type-Options: nosniff`
(`user.controller.ts`). Аватар приватный (пользователь — только в
`Authorization: Bearer`), поэтому кэш приватный, а версия аватара
брейк-кэшируется на клиенте через `?v=` (avatarVersion в `auth-context`).
Фронтенд дедуплицирует запросы аватара между инстансами (header + profile)
через module-level кэш промисов в `user-avatar.tsx`.

Смена пароля инвалидирует все ранее выданные JWT: в `User.tokenVersion`
хранится текущая версия токена, она кладётся в payload при sign, а
`JwtStrategy.validate` сверяет её с БД на каждом запросе и при несовпадении
возвращает 401. `PATCH /user/password` инкрементирует `tokenVersion`.
Фронтенд после смены пароля автоматически перелогинивается, чтобы обновить
токен (`password-section.tsx`).

## Правила

- Модульная архитектура NestJS (feature modules, не перегружать `app.module.ts`).
- Для новых фич создавать отдельные модули.
- Для сложной логики — CQRS (папки `commands/` и `queries/`). Для простого CRUD — Service.
- DTO через `class-validator` / `class-transformer`.
- Обработка ошибок через встроенные NestJS Exception Filters.
- **Язык ошибок**: API возвращает пользовательские сообщения на английском как стабильные ключи; перевод на русский — единый модуль фронтенда `apps/web/src/lib/api-errors.ts` (`translateApiError`). Не возвращай локализованные (русские) сообщения из API.
- `@Global()` модули (PrismaModule) не импортировать в feature module — они доступны без импорта.
