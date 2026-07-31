# Meeting AI — Monorepo

## Overview

Meeting AI — монолитное приложение для обработки и анализа встреч (meeting intelligence). Состоит из двух приложений в npm workspaces:

| App     | Path       | Stack                                         |
| ------- | ---------- | --------------------------------------------- |
| **Web** | `apps/web` | Next.js 15 (App Router) + React 19 + HeroUI v3 |
| **API** | `apps/api` | NestJS 10 (Express)                            |

## Quick start

```bash
npm install              # установка зависимостей (workspaces)
npm run dev              # запуск web (port 3000) + api (port 3001)
npm run build            # сборка shared + обоих приложений
```

## Доступные скрипты

| Команда                | Описание                                          |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Запуск web и api параллельно через `concurrently` |
| `npm run dev:web`      | Только frontend                                   |
| `npm run dev:api`      | Только backend                                    |
| `npm run build`        | Сборка shared + обоих приложений                  |
| `npm run build:shared` | Сборка `@meeting-ai/shared` (`packages/shared`)   |
| `npm run build:web`    | Только web                                        |
| `npm run build:api`    | Только api                                        |
| `npm run test`         | Тесты web + api (unit)                            |
| `npm run test:web`     | Тесты только web (Vitest)                         |
| `npm run test:api`     | Тесты только api (Jest, unit)                     |
| `npm run test:e2e`     | E2E: api (Jest, supertest) + web (Playwright)     |
| `npm run test:e2e:api` | E2E только api (`apps/api/test/*.e2e-spec.ts`)    |
| `npm run test:e2e:web` | E2E только web (`apps/web/e2e/`, Playwright)      |
| `npm run lint`         | ESLint по всем файлам `apps/**/*.{ts,tsx}`        |
| `npm run format`       | Prettier — форматирование                         |
| `npm run format:check` | Prettier — проверка без записи                    |

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
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── auth/        # CQRS (register/login)
│   │       ├── user/        # /user/profile
│   │       ├── meetings/    # CRUD встреч
│   │       ├── files/       # загрузка/список/скачивание/просмотр/удаление файлов
│   │       └── common/      # guards, filters
│   └── web/          # Next.js фронтенд (детали — в apps/web/CLAUDE.md)
│       ├── src/
│       │   ├── app/         # /, /login, /signup, (authenticated) (создание + список встреч), (authenticated)/meetings/[id]
│       │   ├── components/  # create-meeting-form, file-upload UI (upload/list/item/preview/icon), providers (Toast)
│       │   ├── contexts/    # auth-context (useAuth)
│       │   └── lib/         # format-date.ts, format-file-size.ts (общие форматтеры)
│       └── e2e/             # Playwright e2e-тесты (file-upload.spec.ts)
├── packages/
│   └── shared/              # @meeting-ai/shared: общие константы (лимиты, MIME-типы), getFileKind
├── design-system/           # ui-ux-pro-max master (палитра, типографика, токены)
├── playwright.config.ts     # конфиг web e2e (webServer api+web, reuseExistingServer)
├── package.json             # корень monorepo (workspaces)
└── ...
```

## Команды для работы с отдельными приложениями

```bash
npm run dev -w apps/web     # dev только для web
npm run dev -w apps/api     # dev только для api
npm run build -w apps/web   # сборка только web
npm run build -w apps/api   # сборка только api
```

## Documentation

- **Документация должна быть актуальной.** При любом изменении кодовой базы или архитектуры проекта — обновляй соответствующие разделы документации: структуру директорий, описание модулей, API-эндпоинты, схемы данных, инструкции по запуску и развёртыванию.
- Если в результате изменений секция `## Структура` или таблица приложений в `## Overview` устаревает — обнови их.
- При добавлении/удалении/переименовании npm-скриптов обнови таблицу в `## Доступные скрипты`.
- При изменении стека (фреймворк, версия, рантайм) обнови таблицу приложений в `## Overview`.

## UI/UX Quality Control

**При любом изменении интерфейса (компоненты, страницы, стили, лейаут) — ОБЯЗАТЕЛЬНО:**

1. **Загрузи скилл `ui-ux-pro-max`** и выполни полную проверку изменённых элементов:
   - Запусти `--design-system` для проекта (если ещё не создан `design-system/meeting-ai/MASTER.md` — создай с ключевыми словами `"meeting intelligence AI SaaS dashboard"`).
   - Пройди по приоритетам 1–10 из таблицы Rule Categories (Accessibility → Touch → Performance → Style → Layout → Typography → Animation → Forms → Navigation → Charts).
   - Проверь изменённые файлы через `references/pro-rules.md` — canonical Pre-Delivery Checklist.

2. **Исправь ВСЕ найденные ошибки** до завершения задачи. Не оставляй UI-проблемы «на потом» — каждое найденное нарушение должно быть исправлено в том же коммите.

3. **Критические проверки (must-have перед любым UI-изменением):**
   - Контраст текста ≥ 4.5:1 (WCAG AA)
   - Минимальный размер интерактивных элементов 44×44px
   - Alt-text для всех изображений/icon-only кнопок — label или aria-label
   - Keyboard navigation — все интерактивные элементы доступны через Tab
   - Нет horizontal scroll ни на одном viewport
   - Нет Cumulative Layout Shift (CLS < 0.1)
   - Все анимации 150–300ms, respects `prefers-reduced-motion`

4. **Визуальное качество:**
   - Используй только SVG-иконки (не emoji)
   - Единая типографика из рекомендаций скилла (base 16px, line-height 1.5)
   - Цвета — из semantic tokens, не raw hex
   - Единая шкала отступов, нет смешанных layout-паттернов
   - Loading states для всех асинхронных операций
   - Error states рядом с полем/элементом, не только вверху страницы

## Skills

Проект использует AI-скиллы — наборы инструкций для Claude, которые помогают выполнять типовые задачи (code review, следование best practices и т.д.). Скиллы хранятся и настраиваются через `.claude/skills/` и `.agents/skills/`.

| Скилл | Путь | Назначение |
|-------|------|------------|
| `meeting-ai-ui-ux-audit` | `.claude/skills/meeting-ai-ui-ux-audit/` | Проектные паттерны UI/UX качества: найденные и исправленные ошибки, чеклисты, шаблоны валидации |
| `git-commit` | `.claude/skills/git-commit/` | Conventional commits |
| `nestjs-best-practices` | `.claude/skills/nestjs-best-practices/` | NestJS архитектура и паттерны |
| `vercel-react-best-practices` | `.claude/skills/vercel-react-best-practices/` | React/Next.js оптимизация |
| `issues` | `.claude/skills/issues/` | Публикация плана (PRD, spec, tickets) как GitHub issues и milestones |
| `ui-ux-pro-max` | `.claude/skills/ui-ux-pro-max/` | Универсальная база UI/UX правил (84 стиля, 192 палитры, 98 гайдлайнов) |

- **При добавлении новой функциональности или возможности** — актуализируй скиллы проекта, чтобы в них всегда была информация об актуальной кодовой базе и о том, где какая функция реализована.
- Если скилл ссылается на конкретные файлы, модули, эндпоинты или компоненты — проверь, что пути и описания соответствуют текущей структуре проекта.
- При создании нового модуля/фичи — подумай, нужно ли расширить существующий скилл или создать новый, описывающий эту часть кодовой базы.
- **Назначение скиллов** — давать Claude контекст о проекте: архитектура, принятые решения, расположение ключевых файлов, паттерны, используемые в проекте. Если в коде появилось что-то, что должен знать AI-ассистент при работе над проектом, — это должно быть в скиллах.

## Git

- Основная ветка: `main`
- Формат коммитов: conventional commits (feat:, fix:, chore:, docs:, refactor:)

## Claude Code hooks

В проекте настроен Claude Code hook для автоматического форматирования кода после изменений, которые вносит Claude:

| Событие       | Триггер          | Действие                                    |
| ------------- | ---------------- | ------------------------------------------- |
| `PostToolUse` | `Write` / `Edit` | Prettier — форматирование изменённого файла |

Хук объявлен в `.claude/settings.json`. Срабатывает каждый раз, когда Claude создаёт или редактирует файл через `Write` или `Edit`. Если после правки форматирование съехало — Prettier автоматически поправит его.


## Загрузка файлов на странице встречи
Используй это исследование - docs/researches/research-file-upload.md