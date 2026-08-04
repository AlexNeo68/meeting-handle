# PRD: User Profile

> **Статус:** Draft
> **Автор:** AI Assistant
> **Дата:** 2026-08-01

---

## 1. Executive Summary

Добавить страницу профиля пользователя (`/profile`), на которой пользователь может менять аватар, имя, email и пароль. В шапке основного лейаута отображать аватар (или фолбэк-инициалы), имя и email пользователя; блок в шапке кликабельный и ведёт на страницу профиля. Для этого расширить модель `User` полями `name` и `avatarStoragePath`, реализовать эндпоинты обновления профиля, загрузки/получения аватара и смены пароля.

## 2. Problem Statement

- **Текущая ситуация:** При регистрации пользователь указывает только email и пароль. Модель `User` не содержит имени и аватара. Существующий `UpdateUserProfileCommand` принимает `name`, но поля `name` в схеме БД нет — команда является заглушкой и упадёт при использовании. В шапке отображается только email и кнопка «Выйти».
- **Боли пользователя:** Пользователь не может персонализировать аккаунт — задать имя, по которому его узнают коллеги, или аватар. Профиль выглядит безликим (только email), нет единого места для управления данными аккаунта. Сменить пароль невозможно.
- **Возможность:** Первый шаг к полноценному профилю (persona, настройки, платёжные данные в будущем). Повышение вовлечённости и доверия к продукту как к meeting intelligence платформе; фундамент для отображения авторов/участников в интерфейсе.

## 3. Goals & Non-Goals

### Goals

- G1: Пользователь может изменить имя и email, данные сохраняются в БД и отображаются в шапке
- G2: Пользователь может загрузить, заменить и удалить аватар (изображение ≤ 5 МБ), при отсутствии аватара показываются инициалы
- G3: Пользователь может сменить пароль (без подтверждения текущего)
- G4: Шапка отображает аватар, имя и email пользователя; блок кликабельный и ведёт на `/profile`
- G5: Изменения профиля мгновенно (после сохранения) отражаются в шапке и localStorage

### Non-Goals

- NG1: Удаление аккаунта (self-service)
- NG2: Верификация email (подтверждение ссылкой/кодом при смене)
- NG3: 2FA / OTP
- NG4: Смена языка и темы в профиле
- NG5: Кроп/редактор аватара
- NG6: Ограничение по количеству сессий и принудительный logout при смене пароля

## 4. User Personas

| Персона | Роль | Потребности |
|---------|------|-------------|
| Алексей | Product Manager | Хочет, чтобы коллеги узнавали его по имени и аватару в шапке; периодически меняет пароль |
| Елена | Team Lead | Задаёт корпоративный email и имя после регистрации, загружает рабочее фото |

## 5. User Stories

1. **P0** As a user, I want to update my display name, so that others can recognize me in the UI.
2. **P0** As a user, I want to change my email, so that I use the correct address for my account.
3. **P0** As a user, I want to upload and replace my avatar, so that my profile looks personal.
4. **P0** As a user, I want to change my password, so that my account stays secure.
5. **P0** As a user, I want to see my avatar, name and email in the header, so that I know which account I am using.
6. **P1** As a user, I want to remove my avatar, so that I can go back to the initials fallback.
7. **P1** As a user, I want to click the header user block, so that I can navigate to the profile page.
8. **P1** As a user, I want to set my display name during registration, so that my profile is filled in from the start.

## 6. Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-1 | `PATCH /user/profile` принимает опциональные `name` и `email`; имя не пустое и ≤ 50 символов | P0 | US-1, US-2 |
| FR-2 | При смене email проверять уникальность → 409 Conflict, если email занят | P0 | US-2 |
| FR-3 | Профиль после обновления возвращается в ответе (`id`, `email`, `name`, `hasAvatar`) | P0 | US-1, US-2 |
| FR-4 | `POST /user/profile/avatar` (multipart, поле `file`): только image/jpeg, image/png, image/webp, ≤ 5 МБ | P0 | US-3 |
| FR-5 | Аватар хранится локально в `uploads/{userId}/avatar/{uuid}-{sanitizedName}`; старый аватар удаляется при замене | P0 | US-3 |
| FR-6 | `GET /user/profile/avatar` стримит изображение (JWT обязателен); при отсутствии аватара — 404 | P0 | US-5 |
| FR-7 | `PATCH /user/password` принимает новый пароль (min 6 символов) и хеширует через bcrypt | P0 | US-4 |
| FR-8 | При отсутствии аватара в UI показывается фолбэк-кружок с инициалами имени (или email) | P0 | US-5 |
| FR-9 | Шапка показывает аватар/инициалы, имя (или email при отсутствии имени) и email | P0 | US-5 |
| FR-10 | Клик по блоку пользователя в шапке ведёт на `/profile` | P1 | US-7 |
| FR-11 | `DELETE /user/profile/avatar` удаляет аватар (с диска + из БД) | P1 | US-6 |
| FR-12 | Все изменения синхронизируются с `AuthContext`/localStorage | P0 | US-1,2,3,5 |
| FR-13 | Санитизация имени файла аватара (аналог `sanitizeOriginalName`) | P0 | US-3 |
| FR-14 | `POST /auth/register` принимает опциональный `name` (≤ 50 символов) и сохраняет его | P1 | US-8 |
| FR-15 | Rate limiting на `PATCH /user/password` (например, 5 попыток / 15 мин) | P0 | US-4 |

## 7. Non-Functional Requirements

| ID | Requirement | Category | Target |
|----|-------------|----------|--------|
| NFR-1 | Аватар max 5 МБ per file | Performance | Лимит на API (multer) |
| NFR-2 | Стриминг аватара через `StreamableFile`, не грузить в память | Performance | GET avatar использует stream |
| NFR-3 | Все эндпоинты профиля защищены JWT | Security | `JwtAuthGuard` на `/user/*` |
| NFR-4 | Path traversal защита при хранении/чтении аватара | Security | resolve + prefix check (как в FilesService) |
| NFR-5 | Пароль хешируется bcrypt (10 rounds), никогда не возвращается в ответах | Security | bcrypt.hash/compare |
| NFR-6 | Минимальный интерактивный элемент ≥ 44×44 px (кнопки загрузки/удаления аватара, сохранения) | UX/Accessibility | WCAG target size |
| NFR-7 | Контраст текста ≥ 4.5:1, ошибки `role="alert"` + `aria-live="polite"` | UX/Accessibility | WCAG AA |
| NFR-8 | Инпут загрузки аватара доступен с клавиатуры, кнопка имеет `aria-label` | UX/Accessibility | Keyboard navigation |
| NFR-9 | Loading states для всех асинхронных операций (загрузка профиля, upload аватара, сохранение) | UX | Spinner/disabled state |
| NFR-10 | Ошибки валидации рядом с полем, не только вверху страницы | UX/Accessibility | Inline validation |
| NFR-11 | Удаление старого аватара с диска: ошибка диска не блокирует сохранение нового | Reliability | Log + continue |
| NFR-12 | Аватар в шапке загружается блобом через fetch с JWT (аналог FilePreview) | Security | Нет публичных URL на файлы |
| NFR-13 | Rate limiting на смену пароля от brute-force | Security | ≤ 5 попыток / 15 мин per user+IP |

## 8. UI/UX Design

### Screens / States

1. **Loading state** — загрузка данных профиля: skeleton-блоки в секциях
2. **Avatar section** — круглый превью (аватар или инициалы), кнопки «Загрузить» и «Удалить»
3. **General section** — поля «Имя» и «Email» с кнопкой «Сохранить»
4. **Password section** — поля «Новый пароль» и «Повторите пароль» с кнопкой «Сменить пароль»
5. **Success state** — toast-уведомление об успешном сохранении
6. **Error states** — инлайн-ошибки под полями (некорректный email, занятый email, короткий пароль, несовпадение паролей)

### Layout

- Страница `/profile` внутри группы `(authenticated)` с общим `Header`
- Вертикальная композиция из трёх секций-карточек (HeroUI `Card`): Avatar → General → Password
- Аватар: круглый превью (96 px) по центру секции, под ним кнопки
- Секции отделены друг от друга, у каждой заголовок (`Card.Header`)

### Accessibility

- Кнопки «Загрузить аватар» / «Удалить» имеют `aria-label`
- Ошибки форм: `role="alert"` + `aria-live="polite"` у каждого поля
- Инпуты с `autoComplete` (`name`, `email`, `new-password`, `current-password`)
- Блок пользователя в шапке — кликабельный элемент ≥ 44×44 px, доступен через Tab
- Аватар в шапке: `alt` с именем пользователя
- Все интерактивные элементы ≥ 44×44 (`min-h-11`)

### Mobile Responsiveness

- Секции карточек растягиваются на всю ширину, `w-full`
- Формы: `<Form className="w-full">`, инпуты `className="w-full"`
- Аватар-превью не ломает layout на узких экранах

### Loading States

- Загрузка профиля: skeleton
- Upload аватара: spinner на кнопке + превью в состоянии загрузки
- Сохранение имени/email и смена пароля: disabled кнопка + spinner

### Error States

- Email занят: инлайн-сообщение под полем email
- Неверный формат email: инлайн-сообщение
- Пароль < 6 символов / не совпадает: инлайн-сообщения
- Сетевая ошибка: toast notification

### Empty States

- Аватар отсутствует: кружок с инициалами имени (или первой буквы email), кнопка «Загрузить аватар»
- Имя не задано: в шапке и в профиле показывается email

## 9. Data Model / Schema Changes

```prisma
model User {
  id                String         @id @default(uuid())
  email             String         @unique
  password          String
  name              String?        // отображаемое имя
  avatarStoragePath String?        // относительный путь: {userId}/avatar/{uuid}-{sanitized}
  avatarMimeType    String?        // внутреннее поле: MIME-тип аватара (не в API-контрактах)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  meetings          Meeting[]
  files             MeetingFile[]
}
```

Изменения:
- Добавить `name String?`
- Добавить `avatarStoragePath String?` (локальное хранение, аналог `storagePath` у `MeetingFile`)
- Добавить `avatarMimeType String?` — **внутреннее (internal) поле**: MIME-тип аватара, детектится один раз при загрузке (magic-bytes через `file-type`) и переиспользуется на `GET /user/profile/avatar` (fallback — повторный детект/`application/octet-stream` для старых записей). В API-контрактах (§10) и в ответах профиля (`toProfile`) **не светится** — клиенту не возвращается.

Миграция:
- `npx prisma migrate dev --name add_user_name_and_avatar`
- `npx prisma generate`

Общие константы в `packages/shared`:
- `MAX_AVATAR_SIZE = 5 * 1024 * 1024`
- `ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']`

## 10. API Contracts

| Method | Endpoint | Request | Response | Notes |
|--------|----------|---------|----------|-------|
| GET | `/auth/me` | — | `{ id, email, name, hasAvatar }` | JWT. Текущий авторизованный профиль (для гидрации шапки/контекста) |
| GET | `/user/profile` | — | `{ id, email, name, hasAvatar }` | JWT. Существует, расширить |
| PATCH | `/user/profile` | `{ name?: string, email?: string }` | `{ id, email, name, hasAvatar }` | JWT. Валидация + уникальность email (409) |
| POST | `/user/profile/avatar` | `multipart/form-data` field `file` | `{ id, email, name, hasAvatar: true }` | JWT. image/* ≤ 5 МБ |
| GET | `/user/profile/avatar` | — | Binary stream (image) | JWT. 404, если нет аватара |
| DELETE | `/user/profile/avatar` | — | `{ message: 'Avatar deleted' }` | JWT. P1 |
| PATCH | `/user/password` | `{ password: string }` | `{ message: 'Password updated' }` | JWT. min 6 символов |

Формат ошибок (единый, как в files):
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

## 11. Implementation Notes

### Modules to create/modify

**Backend (`apps/api/src/`):**
- `user/` — расширить существующий модуль
  - `user.service.ts` — добавить `updateProfile(userId, { name?, email? })`, `changePassword(userId, password)`, `uploadAvatar(file, userId)`, `removeAvatar(userId)`, `getAvatar(userId)`
  - `dto/update-user-profile.dto.ts` — `name` (IsString, MaxLength 50, IsOptional), `email` (IsEmail, IsOptional)
  - `dto/change-password.dto.ts` — `password` (IsString, MinLength 6)
  - `commands/` — обновить `UpdateUserProfileCommand`, добавить `ChangePasswordCommand`, `UploadAvatarCommand`, `RemoveAvatarCommand`
  - `queries/get-user-profile.query.ts` — включить `name` и `hasAvatar`
  - `user.controller.ts` — эндпоинты avatar (upload/download/remove) с `FileInterceptor('file')` и `StreamableFile`
- `prisma/schema.prisma` — поля `name`, `avatarStoragePath`
- `auth/commands/register.handler.ts` — принимать опциональный `name` при регистрации (RegisterCommand + RegisterDto)
- `auth/queries/` — добавить `GetMeQuery` + handler и `GET /auth/me` в `auth.controller.ts` (PrismaService напрямую, как в register/login)

**Frontend (`apps/web/src/`):**
- `app/(authenticated)/profile/page.tsx` — страница профиля (client component)
- `components/profile/` — секции: `avatar-section.tsx`, `general-section.tsx`, `password-section.tsx` (опционально в одном файле `profile-form.tsx`)
- `components/header.tsx` — блок аватар + имя + email, клик → `/profile`
- `components/user-avatar.tsx` — переиспользуемый аватар с фолбэк-инициалами (для шапки и профиля)
- `contexts/auth-context.tsx` — гидрация профиля через `GET /api/auth/me` (login + загрузка приложения), добавить `updateUser(partial)` для синхронизации localStorage/state

### Key architectural decisions

1. **Хранение аватара:** локальная ФС, `uploads/{userId}/avatar/{uuid}-{sanitizedName}` (аналог FilesModule). В БД хранится только относительный путь.
2. **Отдача аватара:** JWT-защищённый `GET /user/profile/avatar` со стримингом (`StreamableFile`). Фронт грузит блоб через `fetch` + `Authorization` и `URL.createObjectURL` — паттерн уже есть в `file-preview.tsx`. Никаких публичных URL.
3. **Профиль в шапке:** шапка читает `user` из `AuthContext`; после сохранения профиля вызывается `updateUser()`, который обновляет state и localStorage.
4. **Валидация через `class-validator`:** `UpdateUserProfileDto` с `whitelist: true, forbidNonWhitelisted: true` (уже включено в `main.ts`).
5. **Смена пароля без подтверждения текущего** — по решению продукта. Пароль только хешируется, в ответе не возвращается.
6. **Multer для аватара:** собственный `FileInterceptor('file')` с `diskStorage` (destination `uploads/{userId}/avatar`), `limits.fileSize = MAX_AVATAR_SIZE`, `fileFilter` по `ALLOWED_AVATAR_MIME_TYPES`.
7. **Замена аватара:** после успешного сохранения нового файла удалить старый с диска (ошибка удаления только логируется).
8. **Rate limiting:** throttle middleware (например, `@nestjs/throttler`) на `PATCH /user/password` — лимит на пользователя и IP, конфигурируемый через env.

### Dependencies

- **External:** `@nestjs/platform-express` (multer) — уже используется в FilesModule
- **External:** `@nestjs/throttler` — rate limiting на смену пароля
- **External:** Prisma Client — после изменения схемы
- **Internal:** AuthModule (`JwtAuthGuard`), `@meeting-ai/shared` (новые константы аватара)

### Migration plan

1. Добавить поля в `schema.prisma`
2. `npx prisma migrate dev --name add_user_name_and_avatar`
3. `npx prisma generate`

### Feature flags

Не требуется — фича включается сразу после деплоя.

## 12. Testing Strategy

| Type | Scope | Approach |
|------|-------|----------|
| Unit | UserService | Mock PrismaService: update profile, unique email (409), change password (bcrypt hash), avatar upload/remove |
| Unit | Handlers (CQRS) | `UpdateUserProfileHandler`, `ChangePasswordHandler` — command → service |
| Integration | Profile endpoints | Supertest + TestingModule: PATCH profile (валидация, 409), PATCH password, avatar upload/stream/delete |
| Unit (frontend) | Header | RTL: рендер аватара/имени/email, фолбэк-инициалы, клик → /profile |
| Unit (frontend) | Profile page | RTL: рендер секций, submit форм, inline-ошибки, updateUser после сохранения |
| E2E | Full flow | Playwright: login → edit profile → see changes in header → change password → re-login |

### Seams
- `PrismaService` — mocking point для всех DB-операций
- `AuthContext.updateUser` — тестируется через мок контекста (аналог `header.spec.tsx`)
- Multer — мок через `@nestjs/testing`

### Prior art
- `apps/api/src/user/user.service.spec.ts` — unit-тесты UserService
- `apps/api/src/files/files.service.ts` — паттерн локального хранения + стриминга
- `apps/web/src/components/file-preview.tsx` — загрузка блоба с JWT
- `apps/web/src/components/header.spec.tsx` — тест шапки с моком `useAuth`
- `apps/web/src/app/login/page.spec.tsx` — тесты форм с HeroUI

## 13. Edge Cases & Failure Modes

- **Email уже занят** → 409 Conflict, инлайн-сообщение под полем email
- **Email не изменился** → не проверять уникальность, просто сохранить (compare со старым)
- **Пустое имя** → 400, имя не может быть пустым
- **Имя длиннее 50 символов** → 400
- **Пароль короче 6 символов** → 400
- **Новый пароль совпадает с текущим** → 400 (nice-to-have проверка через bcrypt.compare)
- **Аватар не картинка / больше 5 МБ** → 400, инлайн-ошибка
- **Загрузка аватара без файла** → 400
- **GET avatar при отсутствии аватара** → 404, UI показывает инициалы
- **Файл аватара удалён с диска вручную (out of sync)** → 404 при GET, UI показывает инициалы
- **Удаление старого аватара при замене упало** → логировать, продолжать (новый уже сохранён)
- **Запрос без JWT** → 401
- **Смена пароля: токен остаётся валидным** → intentional (non-goal NG6), сессии не инвалидируются

## 14. Success Metrics

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| % пользователей с заполненным именем | N/A | > 50% | DB: users with name / total |
| % пользователей с аватаром | 0% | > 30% | DB: users with avatarStoragePath / total |
| Успешность смены пароля | N/A | > 99% | Logs: успешные / всего попыток |
| Успешность загрузки аватара | N/A | > 98% | Logs: успешные uploads / total |
| Сбои обновления профиля (validation/conflict) | N/A | < 5% | Logs: 4xx profile updates / total |

## 15. Open Questions

- **S3/облачное хранение аватаров?** — Owner: backend / Status: TBD (в текущей итерации — локально, как files)

## 16. Dependencies

- **External:** `@nestjs/platform-express` (multer) — уже есть
- **Internal:** AuthModule (JwtAuthGuard), `@meeting-ai/shared` (константы аватара)
- **Pre-requisites:** Миграция Prisma (поля `name`, `avatarStoragePath`)

## 17. Release Plan

| Phase | Scope | Timeline | Success Criteria |
|-------|-------|----------|------------------|
| P1 (MVP) | Изменение имени/email, смена пароля + rate limiting, загрузка/отдача аватара, отображение в шапке + клик → /profile, страница /profile, имя при регистрации | Sprint N | Все P0 stories pass. API + web unit tests green. |
| P2 | Удаление аватара | Sprint N+1 | Все P1 stories pass. E2E green. |

## 18. Out of Scope

- Удаление аккаунта
- Верификация email
- 2FA / OTP
- Смена языка и темы
- Кроп/редактор аватара
- Инвалидация сессий при смене пароля
- Интеграция с внешними провайдерами (Google, GitHub)
- Экспорт/импорт данных пользователя

## 19. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Аватар | Изображение пользователя, отображаемое в шапке и на странице профиля |
| Фолбэк-инициалы | Кружок с инициалами имени (или первой буквой email) при отсутствии аватара |
| hasAvatar | Флаг в профиле: есть ли сохранённый аватар (без раскрытия пути к файлу) |
| sanitizeOriginalName | Очистка имени файла от спецсимволов и path traversal попыток |

### References

- [NestJS File Upload docs](https://docs.nestjs.com/techniques/file-upload) — multer
- [NestJS StreamableFile](https://docs.nestjs.com/techniques/streaming-files) — стриминг аватара
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) — хеширование пароля (уже используется)
- Prior art в проекте: `apps/api/src/files/` (хранение/стриминг файлов), `apps/api/src/user/` (CQRS профиля), `apps/web/src/components/header.tsx` (шапка), `apps/web/src/components/file-upload/file-preview.tsx` (блоб-загрузка с JWT)

### Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-08-01 | AI Assistant | Initial draft |
