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
├── src/
│   ├── main.ts           # точка входа, создание Nest-приложения
│   └── app.module.ts     # корневой модуль
├── nest-cli.json         # конфигурация NestJS CLI
├── tsconfig.json
└── package.json
```

## Правила

- Модульная архитектура NestJS (feature modules, не перегружать `app.module.ts`).
- Для новых фич создавать отдельные модули.
- Использовать `class-validator` / `class-transformer` для DTO (если будут добавлены).
- Контроллеры → Сервисы → Модули — стандартный NestJS flow.
- Обработка ошибок через встроенные NestJS Exception Filters.
