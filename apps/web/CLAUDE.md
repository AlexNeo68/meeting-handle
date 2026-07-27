# Web — Next.js Frontend

## Stack

- **Next.js** 15 (App Router)
- **React** 19
- TypeScript 5.4
- **HeroUI v3** (component library)
- **Tailwind CSS v4**

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
│       ├── layout.tsx          # корневой layout (App Router)
│       ├── page.tsx            # главная страница (/)
│       ├── globals.css         # глобальные стили (Tailwind + HeroUI)
│       └── signup/
│           ├── page.tsx        # страница регистрации
│           └── layout.tsx      # metadata для /signup
├── next.config.js
├── postcss.config.mjs          # PostCSS (Tailwind CSS v4)
├── tsconfig.json
└── package.json
```

## Правила

- App Router — новая страница = новая папка в `src/app/`.
- **Client components** — только там, где нужны хуки, состояние или браузерные API. По умолчанию server components.
- **HeroUI v3** — используй compound components (e.g., `Card.Header`, `Card.Content`), не flat props.
- **HeroUI v3** — используй `onPress` вместо `onClick` для лучшей доступности.
- **HeroUI v3** — Provider не нужен (v3 не требует `<HeroUIProvider>`).
- **HeroUI v3** — используй семантические варианты (`primary`, `secondary`, `tertiary`) вместо raw colors.
- **HeroUI v3 Form** — не ставь `validationBehavior="aria"` на `<Form>` если не нужно real-time (вызывает ошибки при mount). Используй `validate` prop на每个 поле + нативную валидацию.
- **HeroUI v3 Form** — все `<Input>` должны иметь `className="w-full"`. Форма: `<Form className="w-full">`.
- **Навигация** — всегда `useRouter().push()`, никогда `window.location.href`.
- **Доступность** — ошибки: `role="alert"` + `aria-live="polite"`. Формы: `aria-label`. Инпуты: `autoComplete`.
- Стили — CSS Modules, Tailwind или `globals.css`. Решение за автором — единообразие внутри фичи.
- Изображения — `next/image` вместо `<img>`.
- Ссылки — `next/link` / `useRouter` вместо `<a>`.
- API-запросы — через серверные компоненты или Route Handlers, где возможно.
