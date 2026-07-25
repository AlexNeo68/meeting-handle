# Web — Next.js Frontend

## Stack

- **Next.js** 14 (App Router)
- **React** 18
- TypeScript 5.4

## Скрипты

```bash
npm run dev       # next dev
npm run build     # next build
npm run start     # next start (production)
npm run lint      # next lint
```

Из корня monorepo:
```bash
npm run dev:web   # npm run dev -w apps/web
npm run build:web # npm run build -w apps/web
```

## Структура

```
apps/web/
├── src/
│   └── app/
│       ├── layout.tsx      # корневой layout (App Router)
│       ├── page.tsx        # главная страница (/)
│       └── globals.css     # глобальные стили
├── next.config.js
├── tsconfig.json
└── package.json
```

## Правила

- App Router — новая страница = новая папка в `src/app/`.
- **Client components** — только там, где нужны хуки, состояние или браузерные API. По умолчанию server components.
- Стили — CSS Modules, Tailwind или `globals.css`. Решение за автором — единообразие внутри фичи.
- Изображения — `next/image` вместо `<img>`.
- Ссылки — `next/link` / `useRouter` вместо `<a>`.
- API-запросы — через серверные компоненты или Route Handlers, где возможно.
