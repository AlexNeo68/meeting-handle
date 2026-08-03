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
npm run test:web  # vitest run (unit, src/**/*.spec.tsx)
```

## E2E (Playwright)

```bash
npm run test:e2e:web   # npx playwright test (конфиг в корне repo)
```

- `playwright.config.ts` в корне repo: `testDir ./apps/web/e2e`, baseURL `http://localhost:3000`, два `webServer` (`dev:api` → готовность `GET /meetings` = 401, `dev:web` → `GET /login` = 200), `reuseExistingServer: true` — подхватывает уже запущенные dev-серверы.
- Спеки: `apps/web/e2e/*.spec.ts`. Исключены из Vitest через `exclude: ['e2e/**', ...]` в `vitest.config.ts`.

## Структура

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # корневой layout (App Router)
│   │   ├── page.tsx            # главная страница (/)
│   │   ├── globals.css         # глобальные стили (Tailwind + HeroUI)
│   │   ├── login/              # /login
│   │   ├── signup/             # /signup (page + layout с metadata)
│   │   └── (authenticated)/    # страницы под авторизацией
│   │       ├── layout.tsx      # проверка токена, header с блоком пользователя и выходом
│   │       ├── page.tsx        # создание встречи (форма) + список встреч (карточки-ссылки)
│   │       ├── meetings/[id]/  # страница встречи: инфо, участники, файлы
│   │       └── profile/        # /profile: карточки «Аватар» (AvatarSection), «Основное» (GeneralSection), «Пароль» (PasswordSection), skeleton при гидрации
│   ├── components/
│   │   ├── create-meeting-form.tsx # форма создания встречи (POST /api/meetings)
│   │   ├── user-avatar.tsx    # круглый аватар (blob fetch с JWT) или инициалы, keyed на avatarVersion
│   │   ├── header.tsx         # блок пользователя (аватар + имя/email) → /profile, кнопка «Выйти»
│   │   ├── profile/           # секции страницы профиля
│   │   │   ├── avatar-section.tsx  # загрузка/замена/удаление аватара (клиентская валидация 5MB/MIME, DELETE + updateUser)
│   │   │   ├── general-section.tsx # имя + email → PATCH /api/user/profile → updateUser(); 409 → инлайн-ошибка
│   │   │   └── password-section.tsx # смена пароля → PATCH /api/user/password; короткий/несовпадение → инлайн
│   │   ├── file-upload/        # file-upload, file-list, file-item, file-preview, file-icon, index
│   │   └── providers.tsx       # AuthProvider + ToastProvider
│   ├── contexts/
│   │   └── auth-context.tsx    # useAuth(): token/user (name/hasAvatar)/login/logout/updateUser/avatarVersion
│   ├── lib/
│   │   ├── api-errors.ts       # перевод англ. сообщений сервера на русский (translateApiError)
│   │   ├── format-date.ts      # общий форматтер дат (formatDate)
│   │   └── format-file-size.ts # общий форматтер размеров (formatFileSize, B/KB/MB/GB/TB)
│   └── test-setup.ts           # vitest setup (jsdom, localStorage)
├── e2e/                        # Playwright e2e-спеки (file-upload.spec.ts)
├── next.config.js              # rewrites /api/* → http://localhost:3001/*
├── postcss.config.mjs          # PostCSS (Tailwind CSS v4)
├── tsconfig.json
└── package.json
```

## API-запросы

Все API-вызовы фронтенда идут через префикс `/api/` (`/api/auth/login`, `/api/meetings/:id/files`). `next.config.js` проксирует `/api/:path*` на `http://localhost:3001/:path*` через rewrites. Префикс `/api/` обязателен — без него rewrite может перехватить page route (например, `/meetings/[id]`).

## Правила

- App Router — новая страница = новая папка в `src/app/`.
- **Client components** — только там, где нужны хуки, состояние или браузерные API. По умолчанию server components.
- **HeroUI v3** — используй compound components (e.g., `Card.Header`, `Card.Content`), не flat props.
- **HeroUI v3** — используй `onPress` вместо `onClick` для лучшей доступности.
- **HeroUI v3** — Provider не нужен (v3 не требует `<HeroUIProvider>`).
- **HeroUI v3** — используй семантические варианты (`primary`, `secondary`, `tertiary`) вместо raw colors.
- **HeroUI v3 Form** — не ставь `validationBehavior="aria"` на `<Form>` если не нужно real-time (вызывает ошибки при mount). Используй `validate` prop на каждом поле + нативную валидацию.
- **HeroUI v3 Form** — все `<Input>` должны иметь `className="w-full"`. Форма: `<Form className="w-full">`.
- **Навигация** — всегда `useRouter().push()`, никогда `window.location.href`.
- **Доступность** — ошибки: `role="alert"` + `aria-live="polite"`. Формы: `aria-label`. Инпуты: `autoComplete`. Интерактивные элементы ≥ 44×44 (`min-h-11`).
- **Общие константы** — MIME-типы и лимит размера берутся из `@meeting-ai/shared` (`packages/shared`), не дублируются на фронте.
- **Форматтеры** — размеры: `formatFileSize` (`src/lib/format-file-size.ts`), даты: `formatDate` (`src/lib/format-date.ts`). Не дублировать локально.
- **Иконки типов файлов** — `FileTypeIcon`/`fileTypeLabel` из `components/file-upload/file-icon.tsx` (inline SVG `aria-hidden` + `sr-only` label).
- **ToastProvider** — placement принимает только RAC-значения: `"bottom end"` (не `"bottom-right"`).
- Стили — CSS Modules, Tailwind или `globals.css`. Решение за автором — единообразие внутри фичи.
- Изображения — `next/image` вместо `<img>`. Иконки — SVG (не emoji).
- Ссылки — `next/link` / `useRouter` вместо `<a>`.
- API-запросы — через префикс `/api/` + rewrites в `next.config.js` (не напрямую на :3001).
