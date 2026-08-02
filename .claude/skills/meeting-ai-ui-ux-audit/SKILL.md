# Skill: meeting-ai-ui-ux-audit

UI/UX аудит и паттерны качества для Meeting AI. Проектные знания, полученные при аудите signup страницы и других UI-компонентов. Используй при рефакторинге, добавлении новых форм и страниц.

---

## Обзор

При аудите `apps/web/src/app/signup/page.tsx` (2026-07-26) было выявлено и исправлено 15+ проблем. Этот документ фиксирует всеfindings и паттерны, чтобы не повторять ошибки.

---

## Критические паттерны (P1-P2)

### 1. HeroUI Form + `validationBehavior="aria"` = ошибки при mount

**Проблема:** `validationBehavior="aria"` на `<Form>` + `isRequired` на пустых полях → HeroUI валидирует сразу при mount, показывая все ошибки одновременно.

**Решение:** Не ставить `validationBehavior="aria"` на уровне `<Form>`. Использовать нативную валидацию браузера (default `native`) + кастомные `validate` функции на每个 поле.

```tsx
// ПРАВИЛЬНО — ошибки только при submit
<Form onSubmit={onSubmit}>
  <TextField isRequired validate={validateEmail}>
    ...
  </TextField>
</Form>

// НЕПРАВИЛЬНО — ошибки сразу при загрузке
<Form validationBehavior="aria" onSubmit={onSubmit}>
  <TextField isRequired validate={validateEmail}>
    ...
  </TextField>
</Form>
```

### 2. `window.location.href` вместо `useRouter`

**Проблема:** Полная перезагрузка страницы, потеря состояния, нет client-side navigation.

**Решение:** Использовать `useRouter` из `next/navigation`:

```tsx
import { useRouter } from 'next/navigation';
const router = useRouter();
// ...
router.push('/dashboard');
```

### 3. Ошибки не доступны скринридерам

**Проблема:** Обычный `<div>` для ошибки → screen reader не объявляет.

**Решение:** `role="alert"` + `aria-live="polite"`:

```tsx
<div role="alert" aria-live="polite" className="...">
  {error}
</div>
```

---

## Средние паттерны (P3-P5)

### 4. Отсутствие `autoComplete` атрибутов

**Проблема:** Браузер не может предзаполнить пароли/-email, ухудшает UX.

**Решение:**

| Поле | autoComplete |
|------|-------------|
| Email | `email` |
| Password (новый) | `new-password` |
| Password (существующий) | `current-password` |

### 5. Password visibility toggle

**Проблема:** Нет возможности показать/скрыть пароль → ошибки ввода.

**Решение:** SVG иконка eye с `aria-label` для переключения, `<button type="button">`:

```tsx
<button
  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
  type="button"
  onClick={() => setShowPassword(prev => !prev)}
>
  <EyeIcon visible={showPassword} />
</button>
```

### 6. Инпуты не растягиваются по ширине

**Проблема:** `TextField` / `Input` без `w-full` → занимает только контентную ширину.

**Решение:** Добавлять `className="w-full"` на:
- `<Form>`
- `<Card.Content>`
- Каждый `<Input>`
- Обёртки `<div className="relative">` для toggle-кнопок

### 7. Отсутствие `aria-label` на `<Form>`

**Проблема:** Форма без label → нет form landmark для скринридера.

**Решение:**

```tsx
<Form aria-label="Форма регистрации" onSubmit={onSubmit}>
```

### 8. Смешение языков в текстах

**Проблема:** `"Перейти к/dashboard"` — микс русского/английского.

**Решение:** Единый язык в интерфейсе: `"Перейти к дашборду"`.

---

## Низкие паттерны (P7+)

### 9. Ссылки на несуществующие страницы

**Проблема:** `"Войти"` → `href="/"` (placeholder, не login).

**Решение:** Ссылаться на реальные маршруты: `href="/login"`.

### 10. Метаданные страницы

**Проблема:** Нет `title` для SEO.

**Решение:** Создать `layout.tsx` в папке маршрута:

```tsx
// apps/web/src/app/signup/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Регистрация — Meeting AI',
  description: '...',
};
```

### 11. `isDisabled` + `isPending` на кнопке

**Проблема:** Кнопка доступна во время отправки → двойной submit.

**Решение:**

```tsx
<Button isDisabled={isLoading} isPending={isLoading} type="submit">
  {({ isPending }) => (
    <>
      {isPending ? <Spinner color="current" size="sm" /> : null}
      {isPending ? 'Отправка...' : 'Отправить'}
    </>
  )}
</Button>
```

---

## Валидация форм — шаблоны

### Email

```tsx
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function validateEmail(value: string): string | null {
  if (!value) return 'Введите email';
  if (!EMAIL_REGEX.test(value)) return 'Введите корректный email адрес';
  return null;
}
```

### Пароль

```tsx
function validatePassword(value: string): string | null {
  if (!value) return 'Введите пароль';
  if (value.length < 6) return 'Пароль должен содержать минимум 6 символов';
  return null;
}
```

### Cross-field (confirm password)

```tsx
function validatePasswordConfirm(value: string, password: string): string | null {
  if (!value) return 'Подтвердите пароль';
  if (value !== password) return 'Пароли не совпадают';
  return null;
}
```

### Checkbox (terms)

```tsx
function validateTerms(isSelected: boolean): string | null {
  if (!isSelected) return 'Необходимо принять условия';
  return null;
}
```

---

## Файлы и загрузка — паттерны (2026-07-31)

Аудит `apps/web/src/components/file-upload/*` + страницы встречи `apps/web/src/app/(authenticated)/meetings/[id]/page.tsx`.

### 12. Dropzone как `button` с `aria-label`

**Проблема:** Вся зона дропа кликабельна, но div — недоступна с клавиатуры.

**Решение:** Один `button` (не div) на весь dropzone + `aria-disabled` во время загрузки:

```tsx
<button
  type="button"
  onClick={openDialog}
  aria-label="Загрузить файл"
  aria-disabled={isUploading}
  className="flex min-h-44 w-full ... border-2 border-dashed ..."
>
  <svg aria-hidden="true">...</svg>
  <span>Перетащите файл сюда или нажмите, чтобы выбрать</span>
  <span>PDF, DOC, аудио и видео до 100 МБ</span>
</button>
<input ref={inputRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" />
```

Скрытый `input[type=file]` — `sr-only`, `tabIndex={-1}`, `aria-hidden="true"` (вызывается только программно через `ref.click()`).

### 13. XHR-загрузка: ProgressBar с `aria-valuenow`

**Решение:** `XMLHttpRequest` для честного прогресса (`xhr.upload.onprogress`), `ProgressBar.Root value={progress}` + `aria-label`, процент в `ProgressBar.Output`. Ошибки API парсятся из `xhr.responseText` и показываются через `toast.danger`.

### 14. Удаление — `AlertDialog` с подтверждением

**Решение:** HeroUI `AlertDialog.Root/Trigger/Container/Dialog/Header/Heading/Body/Footer` — деструктивное действие всегда через confirm-диалог с явным «Удалить». Кнопка удаления: `isDisabled`+`isPending` во время запроса.

### 15. Blob-скачивание без смены страницы

**Решение:** `fetch` → `res.blob()` → `URL.createObjectURL` → временный `<a download>` → клик → revoke. Кнопка получает `aria-label="Скачать файл"`.

### 16. Skeleton-состояние загрузки списка

**Решение:** Пока грузится список файлов — skeleton-строки (не спиннер на весь блок), empty state с CTA («Загрузить первый файл»), ошибка `role="alert"`.

### 17. API-префикс `/api/` — конфликт с page route

**Проблема:** Rewrite `/meetings/:path*` в `next.config.js` перехватывал page route `/meetings/[id]` — вместо страницы приходил 401 от API.

**Решение:** Все API-вызовы фронтенда идут через префикс `/api/` (`/api/meetings/...`, `/api/auth/...`, `/api/user/...`), rewrites маппят `/api/*` на `localhost:3001/*`. Страничные маршруты больше не пересекаются с прокси.

### 18. Media preview — `figure`/`figcaption`, blob URL + revoke

**Решение:** Audio/video превью — семантическая пара `<figure>` + `<figcaption>` (имя файла). Контент — blob URL из `fetch` (`URL.createObjectURL`), `revokeObjectURL` в `useEffect` cleanup. `<video>` с `preload="metadata"` и `controls` — не грузит медиа целиком, только заголовок.

### 19. Иконки типов файлов — SVG + `sr-only` label

**Решение:** `FileTypeIcon` (`apps/web/src/components/file-upload/file-icon.tsx`) — inline SVG по `FileKind` (audio/video/pdf/doc/other) из `@meeting-ai/shared` (`getFileKind(mime)`). Единая карта `FILE_TYPE_META` (label + glyph), общий `FILE_GLYPH` для документов, атрибут `data-file-type={kind}` для тестов, `aria-hidden="true"` на `<svg>` + `sr-only` span с человекочитаемым label (`fileTypeLabel()`: «Аудиофайл», «Видеофайл», «PDF-документ», «Документ», «Файл`). Проп `hideLabel` — когда иконка уже сопровождается видимым текстом (например, в preview). Иконка декоративная, доступность несёт текст.

### 20. `formatFileSize` — единый форматтер размеров

**Решение:** `apps/web/src/lib/format-file-size.ts` — `formatFileSize(bytes)` (без locale): латинские единицы B/KB/MB/GB/TB, десятичная точка, обрезка `.0` (`1.5 KB`, `23 MB`). Возвращает `''` для невалидных значений. Не дублировать форматтер по компонентам (в UI показывать через него, а не «КБ/МБ» вручную).

### 21. Indeterminate-фаза после загрузки

**Решение:** После `xhr.upload.onload` сервер ещё обрабатывает файл → `isIndeterminate` на `ProgressBar.Root` (HeroUI включает CSS-анимацию, `motion-reduce:animate-none` встроен), aria-label «Обработка файла», Output «Обработка...». Переход «Загрузка N% → Обработка → готово» честно отражает две фазы.

### 22. Preview для всех типов файлов

**Решение:** Кнопка «Просмотреть» — для каждого файла (`aria-expanded` + `aria-controls`). Медиа — inline player, документы — блок с `FileTypeIcon` и именем файла (без размера). Для не-media **не** делается blob-`fetch` (ранний return в `useEffect`) — документ превьюится только локальной иконкой. Нет «мёртвых» иконок-бездействий.

---

## Профиль — формы (2026-08-02)

Аудит `apps/web/src/app/(authenticated)/profile/page.tsx` + `apps/web/src/components/profile/general-section.tsx` + `password-section.tsx` (T7).

### 23. Профиль: 3 карточки + skeleton на гидрации

**Решение:** Страница `/profile` — три stacked HeroUI `Card` («Аватар» / «Основное» / «Пароль»). Пока `user` в AuthContext не загружен (гидрация через `GET /api/auth/me`) — skeleton-блоки (HeroUI `Skeleton`) вместо спиннера на всю страницу (NFR-9).

### 24. Инлайн-ошибка 409 email + `aria-describedby`

**Решение:** Ошибки от сервера, привязанные к полю (занятый email → 409 «Email already exists»), показываются **рядом с полем** (не вверху): `<p role="alert" aria-live="polite" id="general-email-error">` + `aria-describedby` на `<Input>` — скринридер объявляет ошибку в контексте поля.

### 25. Client-side cross-field валидация (confirm password)

**Решение:** Совпадение паролей проверяется на клиенте через `validate` функцию, замыкающуюся на `newPassword` (`useCallback` с dep `[newPassword]`). `autoComplete="new-password"` на обоих полях пароля. Короткий (< 6) / несовпадающий пароль — `FieldError` рядом с полем, submit не уходит. Сетевые ошибки → `toast.danger`, server-ошибки (429 rate limit и т.п.) → инлайн `role="alert"` + toast.

### 26. Профиль: пустое имя → email

**Решение:** Empty state имени — форма показывает email (и в шапке, и в профиле), аватар-фолбэк — первая буква email. В форме «Основное» пустое имя блокируется инлайн-ошибкой «Введите имя» (сервер: `Matches(/.*\S.*/, 'Name must not be empty')`), имя > 50 символов — инлайн-ошибка.

---

## Структура компонента — чеклист

Перед отправкой UI-компонента проверить:

- [ ] Нет `validationBehavior="aria"` на `<Form>` (если не нужно real-time)
- [ ] Все `<Input>` имеют `className="w-full"`
- [ ] `autoComplete` на каждом поле ввода
- [ ] Ошибки: `role="alert"` + `aria-live="polite"`
- [ ] `<Form>` имеет `aria-label`
- [ ] Кнопка submit: `isDisabled` + `isPending` во время загрузки
- [ ] Навигация через `useRouter`, не `window.location.href`
- [ ] Все ссылки ведут на реальные маршруты
- [ ] Тексты на одном языке (без миксов)
- [ ] Metadata страницы (title, description)
- [ ] Password toggle: SVG + `aria-label` + `type="button"`
- [ ] Интерактивные элементы ≥ 44×44 (min-h-11), контраст ≥ 4.5:1
- [ ] Dropzone: `button` + `aria-label` + скрытый `input[type=file]`
- [ ] Асинхронные операции: loading state (skeleton/progressbar) рядом с элементом
- [ ] Деструктивные действия: confirm-диалог (`AlertDialog`)
- [ ] Ошибки от API показываются через `toast.danger`, не только в консоли
- [ ] API-вызовы идут через префикс `/api/` (не конфликтуют с page routes)
- [ ] Lint и build проходят без ошибок
- [ ] Media preview: `figure`/`figcaption`, blob URL + revoke, `preload="metadata"`
- [ ] Иконки типов: inline SVG `aria-hidden` + `sr-only` label (не emoji)
- [ ] Формат размеров через общий `formatFileSize` (B/KB/MB/GB/TB)
- [ ] Двухфазный прогресс: `isIndeterminate` на время обработки после загрузки
- [ ] Preview доступен для всех типов файлов (документы — иконка+имя, без blob-фетча)

---

## Файлы

| Файл | Описание |
|------|----------|
| `apps/web/src/app/signup/page.tsx` | Signup страница (аудит пройден) |
| `apps/web/src/app/signup/layout.tsx` | Metadata для signup |
| `apps/web/src/app/(authenticated)/page.tsx` | Список встреч (карточки-ссылки на `/meetings/[id]`) |
| `apps/web/src/app/(authenticated)/meetings/[id]/page.tsx` | Страница встречи: инфо, участники, секция файлов |
| `apps/web/src/components/file-upload/file-upload.tsx` | Dropzone + XHR-загрузка с прогрессом, валидация 100MB/MIME (константы из `@meeting-ai/shared`) |
| `apps/web/src/components/file-upload/file-list.tsx` | Список файлов: skeleton, empty state, error, refreshToken |
| `apps/web/src/components/file-upload/file-item.tsx` | Строка файла: скачивание (blob), удаление (AlertDialog), inline preview |
| `apps/web/src/components/file-upload/file-preview.tsx` | Audio/video inline player (blob URL + revoke) / документ: иконка+имя (без blob-фетча), error state |
| `apps/web/src/components/file-upload/file-icon.tsx` | `FileTypeIcon` (SVG по `FileKind` из `@meeting-ai/shared`) + `fileTypeLabel`, проп `hideLabel` |
| `apps/web/src/lib/format-file-size.ts` | Общий `formatFileSize` (B/KB/MB/GB/TB) |
| `apps/web/src/lib/format-date.ts` | Общий `formatDate` (используется на страницах встреч и списка) |
| `playwright.config.ts` | E2E-конфиг (root): 2 webServer (api :3001, web :3000), `reuseExistingServer` |
| `apps/web/e2e/file-upload.spec.ts` | Playwright e2e: upload→preview→download→delete + клиентская валидация |
| `apps/web/src/components/user-avatar.tsx` | Круглый аватар: blob fetch `GET /api/user/profile/avatar` с JWT (keyed на `avatarVersion`) или инициалы (имя → первые буквы, иначе первая буква email), `<img alt={name}>` |
| `apps/web/src/components/profile/avatar-section.tsx` | Загрузка/замена аватара: клиентская валидация `MAX_AVATAR_SIZE`/`ALLOWED_AVATAR_MIME_TYPES` из `@meeting-ai/shared`, инлайн-ошибка, updateUser + bumpAvatarVersion |
| `apps/web/src/components/profile/general-section.tsx` | Форма «Основное»: имя + email, `PATCH /api/user/profile` → `updateUser()`, 409 → инлайн-ошибка у email, `autoComplete="name"/"email"`, skeleton/disabled+spinner |
| `apps/web/src/components/profile/password-section.tsx` | Форма «Пароль»: новый + повтор (`new-password`), client-side match check, `PATCH /api/user/password`, инлайн (короткий/несовпадение) + toast (сеть/429) |
| `apps/web/src/app/(authenticated)/profile/page.tsx` | Страница профиля: 3 stacked Cards (Avatar/General/Password), skeleton при `user === null` |
| `apps/web/src/components/providers.tsx` | ToastProvider (`placement="bottom end"`), AuthProvider |
| `apps/web/src/contexts/auth-context.tsx` | Auth: login/register, token в localStorage, гидрация `GET /api/auth/me`, `updateUser(partial)`, `avatarVersion` |
| `apps/web/next.config.js` | Rewrites `/api/*` → `localhost:3001/*` |
| `apps/web/src/app/globals.css` | Глобальные стили (Tailwind + HeroUI) |
| `apps/web/src/app/layout.tsx` | Root layout |

---

## История аудита

| Дата | Файл | Найдено | Исправлено |
|------|------|---------|------------|
| 2026-07-26 | `signup/page.tsx` | 15 проблем | 15 исправлений |
| 2026-07-31 | `file-upload/*`, `meetings/[id]/page.tsx` | rewrite-конфликт `/meetings/:path*` ↔ `/meetings/[id]` | префикс `/api/` для всех API-вызовов |
| 2026-07-31 | `file-upload/*` (code review) | RU-aria-labels с миксами языков, нет `aria-live`, touch targets < 44px, дубли `formatDate` и MIME-констант | RU-aria-labels с именем файла, `aria-live="polite"` на ошибках, `min-h-11` на интерактиве, общий `format-date.ts`, `@meeting-ai/shared` |
| 2026-07-31 | `file-upload/*` (P2 polish, issue #6) | preview только для медиа, дубли `formatBytes`/иконок, нет индикации «обработки» после загрузки | `file-preview.tsx` для всех типов, `file-icon.tsx` + `format-file-size.ts`, `isIndeterminate` прогресс |
| 2026-07-31 | `file-upload/*` (code review #6 fixes) | дублирование MIME-констант в `file-icon.tsx`, кириллические единицы/`.0` в размерах, blob-фетч для документов, неоднозначный progress | `getFileKind`/`FileKind` в `@meeting-ai/shared`, `formatFileSize` → B/KB/MB/GB/TB, ранний return в preview для не-media, `value={undefined}` в indeterminate, e2e (backend+frontend) |
| 2026-08-02 | `profile/page.tsx`, `components/profile/*` (T7) | — | паттерны 23–26: 3 stacked Cards + skeleton, инлайн-ошибка 409 с `aria-describedby`, cross-field валидация пароля, empty state «пустое имя → email» |

### Все исправления (signup/page.tsx)

1. Добавлена regex-валидация email через `validate` prop
2. Добавлена кастомная валидация пароля через `validate` prop
3. Добавлено поле `passwordConfirm` с cross-field валидацией
4. Добавлен Checkbox "Согласен с условиями" с `isRequired` + `validate`
5. Ошибки: `role="alert"` + `aria-live="polite"`
6. Форма: `aria-label="Форма регистрации"`
7. Навигация: `useRouter().push()` вместо `window.location.href`
8. Текст: `"Перейти к дашборду"` вместо `"к/dashboard"`
9. Ссылка "Войти": `href="/login"` вместо `href="/"`
10. Password toggle: SVG eye icons с `aria-label`
11. `autoComplete`: `email`, `new-password` на полях
12. Кнопка: `isDisabled` + `isPending` во время loading
13. Убрано `validationBehavior="aria"` — ошибки только при submit
14. `w-full` на всех Input и обёртках для корректной ширины
15. Metadata: `title: "Регистрация — Meeting AI"` в layout.tsx
