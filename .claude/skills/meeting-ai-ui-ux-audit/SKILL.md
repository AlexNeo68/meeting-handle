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
- [ ] Lint и build проходят без ошибок

---

## Файлы

| Файл | Описание |
|------|----------|
| `apps/web/src/app/signup/page.tsx` | Signup страница (аудит пройден) |
| `apps/web/src/app/signup/layout.tsx` | Metadata для signup |
| `apps/web/src/app/globals.css` | Глобальные стили (Tailwind + HeroUI) |
| `apps/web/src/app/layout.tsx` | Root layout |

---

## История аудита

| Дата | Файл | Найдено | Исправлено |
|------|------|---------|------------|
| 2026-07-26 | `signup/page.tsx` | 15 проблем | 15 исправлений |

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
