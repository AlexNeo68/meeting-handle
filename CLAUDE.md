# Meeting AI — Monorepo

## Overview

Meeting AI — монолитное приложение для обработки и анализа встреч (meeting intelligence). Состоит из двух приложений в npm workspaces:

| App | Path | Stack |
|---|---|---|
| **Web** | `apps/web` | Next.js 14 (App Router) + React 18 |
| **API** | `apps/api` | NestJS 10 (Express) |

## Quick start

```bash
npm install              # установка зависимостей (workspaces)
npm run dev              # запуск web (port 3000) + api (port 3001)
npm run build            # сборка обоих приложений
```

## Доступные скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск web и api параллельно через `concurrently` |
| `npm run dev:web` | Только frontend |
| `npm run dev:api` | Только backend |
| `npm run build` | Сборка обоих приложений |
| `npm run build:web` | Только web |
| `npm run build:api` | Только api |
| `npm run lint` | ESLint по всем файлам `apps/**/*.{ts,tsx}` |
| `npm run format` | Prettier — форматирование |
| `npm run format:check` | Prettier — проверка без записи |

## Code style

- ESLint + `@typescript-eslint` + Prettier
- **Single quotes**, trailing commas, 100 print width, 2 spaces tab
- Unix (LF) line endings
- `no-unused-vars` — warn, с исключением для `_`-префикса
- `no-explicit-any` — warn

## Структура

```
meeting-ai/
├── apps/
│   ├── api/          # NestJS бэкенд
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   └── ...
│   └── web/          # Next.js фронтенд
│       └── src/
│           └── app/
│               ├── layout.tsx
│               ├── page.tsx
│               └── globals.css
├── package.json       # корень monorepo (workspaces)
└── ...
```

## Команды для работы с отдельными приложениями

```bash
npm run dev -w apps/web     # dev только для web
npm run dev -w apps/api     # dev только для api
npm run build -w apps/web   # сборка только web
npm run build -w apps/api   # сборка только api
```

## Git

- Основная ветка: `main`
- Формат коммитов: conventional commits (feat:, fix:, chore:, docs:, refactor:)
