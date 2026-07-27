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
│   ├── schema.prisma         # схема БД (модели User, Meeting)
│   └── migrations/           # миграции Prisma
├── src/
│   ├── main.ts               # точка входа, создание Nest-приложения
│   ├── app.module.ts         # корневой модуль
│   ├── prisma/               # PrismaModule (глобальный, @Global())
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/                 # модуль аутентификации (CQRS)
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── commands/
│   │   │   ├── register.command.ts
│   │   │   └── register.handler.ts
│   │   ├── queries/
│   │   │   ├── login.query.ts
│   │   │   └── login.handler.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── meetings/             # модуль встреч (Service + Controller)
│   │   ├── meeting.module.ts
│   │   ├── meeting.controller.ts
│   │   ├── meeting.service.ts
│   │   └── dto/
│   │       └── create-meeting.dto.ts
│   └── common/               # общие утилиты
│       └── decorators/
│           └── user-id.decorator.ts
├── test/                     # E2E тесты
│   ├── auth.e2e-spec.ts
│   ├── meetings.e2e-spec.ts
│   └── jest-e2e.json
├── nest-cli.json
├── tsconfig.json
└── package.json
```

## CQRS

Проект использует `@nestjs/cqrs` для модулей со сложной бизнес-логикой (auth). Модули с простым CRUD используют напрямую `Service` (meetings).

### Когда использовать CQRS

- **CQRS** — если операция требует валидации, проверок, побочных эффектов, интеграции с внешними сервисами (auth: регистрация с хешированием пароля + генерация JWT).
- **Service** — если операция сводится к прямому CRUD (meetings: create/read с одним Prisma-запросом).

### Паттерн CQRS (на примере auth)

```
Controller → CommandBus / QueryBus → Handler → Prisma
```

| Слой       | Файл                           | Назначение                                                       |
| ---------- | ------------------------------ | ---------------------------------------------------------------- |
| DTO        | `dto/register.dto.ts`          | Валидация входящих данных (`class-validator`)                    |
| Command    | `commands/register.command.ts` | Plain class с `public readonly` полями                           |
| Handler    | `commands/register.handler.ts` | `@CommandHandler(RegisterCommand)`, implements `ICommandHandler` |
| Query      | `queries/login.query.ts`       | Plain class                                                      |
| Handler    | `queries/login.handler.ts`     | `@QueryHandler(LoginQuery)`, implements `IQueryHandler`          |
| Module     | `auth.module.ts`               | Импортирует `CqrsModule`, регистрирует хендлеры в `providers`    |
| Controller | `auth.controller.ts`           | Инжектит `CommandBus` и `QueryBus`, вызывает `.execute()`        |

**Command** — мутирующая операция (CUD). Именуется глаголом: `RegisterCommand`.
**Query** — читающая операция (R). Именуется существительным: `LoginQuery`.

Хендлеры декорируются `@CommandHandler()` / `@QueryHandler()` и регистрируются как `providers` в модуле. Контроллер не знает о конкретном хендлере — он отправляет команду/запрос через шину (`CommandBus.execute`, `QueryBus.execute`).

### Паттерн Service (на примере meetings)

```
Controller → Service → Prisma
```

Простой CRUD без шины: контроллер вызывает методы сервиса напрямую.

## Правила

- Модульная архитектура NestJS (feature modules, не перегружать `app.module.ts`).
- Для новых фич создавать отдельные модули.
- Для сложной логики — CQRS (папки `commands/` и `queries/`). Для простого CRUD — Service.
- DTO через `class-validator` / `class-transformer`.
- Обработка ошибок через встроенные NestJS Exception Filters.
- `@Global()` модули (PrismaModule) не импортировать в feature module — они доступны без импорта.
