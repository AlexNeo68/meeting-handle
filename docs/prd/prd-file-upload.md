# PRD: File Upload for Meetings

> **Статус:** Draft
> **Автор:** AI Assistant
> **Дата:** 2026-07-30

---

## 1. Executive Summary

Добавить на страницу встречи возможность загружать файлы (аудио/видео-записи и документы) для последующей обработки (транскрибация, анализ). Пользователь сможет загружать, просматривать список, удалять и скачивать файлы. Ограничение на размер файла — 100 MB. Файлы хранятся локально на сервере.

## 2. Problem Statement

- **Текущая ситуация:** В приложении есть модель Meeting (встреча), но нет возможности прикрепить к ней файлы — записи разговоров, презентации, документы. Пользователь создаёт встречу, но не может загрузить связанные материалы.
- **Боли пользователя:** Нельзя загрузить аудио-запись встречи для последующей транскрибации. Нет единого места для хранения материалов встречи. После создания встречи пользователь вынужден хранить файлы отдельно.
- **Возможность:** Заложить фундамент для пайплайна обработки файлов (транскрибация, AI-анализ). Повысить ценность продукта как meeting intelligence platform.

## 3. Goals & Non-Goals

### Goals

- G1: Пользователь может загрузить файл (до 100 MB) к конкретной встрече
- G2: Пользователь может просмотреть список файлов встречи с метаданными
- G3: Пользователь может скачать файл или открыть превью (плеер для аудио/видео)
- G4: Пользователь может удалить файл
- G5: Файлы изолированы по пользователям и встречам (security)

### Non-Goals

- NG1: Обработка/транскрибация файлов (следующая итерация)
- NG2: Редактирование файлов (обрезка аудио, конвертация)
- NG3: Шаринг файлов между пользователями
- NG4: S3/облачное хранение (в текущей итерации — локальное)
- NG5: Drag-and-drop reorder файлов в списке
- NG6: Поиск по содержимому файлов

## 4. User Personas

| Персона | Роль | Потребности |
|---------|------|-------------|
| Алексей | Product Manager | Записывает встречи, загружает аудио для транскрибации, прикрепляет презентации |
| Елена | Team Lead | Загружает записи стендапов, хочет видеть список файлов встречи и скачивать их |

## 5. User Stories

1. **P0** As a user, I want to upload an audio/video file or document to a meeting, so that the file is stored and available for processing.
2. **P0** As a user, I want to see a list of all files attached to a meeting, so that I can find what I need.
3. **P0** As a user, I want to download a file from a meeting, so that I can use it locally.
4. **P0** As a user, I want to delete a file from a meeting, so that I can remove incorrect or outdated files.
5. **P1** As a user, I want to preview audio/video files inline, so that I can check the content without downloading.
6. **P1** As a user, I want to see upload progress, so that I know the file is being transferred.
7. **P2** As a user, I want to see file type icons and size formatting, so that I can quickly identify file types.

## 6. Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-1 | Upload file to meeting via multipart/form-data | P0 | US-1 |
| FR-2 | Validate file size ≤ 100 MB на backend | P0 | US-1 |
| FR-3 | Validate MIME type — разрешены audio/\*, video/\*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.\* | P0 | US-1 |
| FR-4 | Store file on local filesystem в директории `uploads/{userId}/{meetingId}/` | P0 | US-1 |
| FR-5 | Save file metadata (original name, MIME type, size, path) в БД | P0 | US-1 |
| FR-6 | Return file metadata after successful upload | P0 | US-1 |
| FR-7 | List all files for a meeting with metadata | P0 | US-2 |
| FR-8 | Download/stream file by file ID | P0 | US-3 |
| FR-9 | Delete file by ID (remove from disk + DB) | P0 | US-4 |
| FR-10 | Show upload progress in UI | P1 | US-6 |
| FR-11 | Inline audio/video player for preview | P1 | US-5 |
| FR-12 | Show file type icon (audio/video/pdf/doc) | P2 | US-7 |
| FR-13 | Format file size in human-readable form (KB, MB) | P2 | US-7 |
| FR-14 | Sanitize original filename to prevent path traversal | P0 | US-1 |
| FR-15 | Only meeting owner can upload/view/download/delete files | P0 | US-1,2,3,4 |

## 7. Non-Functional Requirements

| ID | Requirement | Category | Target |
|----|-------------|----------|--------|
| NFR-1 | Upload max 100 MB per file | Performance | 100 MB limit enforced at API + nginx/reverse proxy |
| NFR-2 | Concurrent uploads: min 3 simultaneous | Performance | 3 parallel uploads without timeout |
| NFR-3 | File access authorised via JWT + ownership check | Security | Only meeting owner can access |
| NFR-4 | Path traversal protection | Security | Filename sanitisation, no `../` in stored path |
| NFR-5 | Upload accessible via keyboard | UX/Accessibility | Upload button focusable, Enter/Space activates |
| NFR-6 | File list accessible via screen reader | UX/Accessibility | aria-labels on action buttons, file list role |
| NFR-7 | Minimum touch target 44×44 px for all actions | UX/Accessibility | Delete, download, upload buttons |
| NFR-8 | Error messages near upload area, not only at top | UX/Accessibility | Inline validation for file type/size errors |
| NFR-9 | Loading state during upload (spinner/progress) | UX | User sees progress indicator |
| NFR-10 | Empty state when no files | UX | "No files uploaded yet" with upload CTA |
| NFR-11 | Failure mode: server disk full → 507 error | Reliability | Graceful error, user-friendly message |

## 8. UI/UX Design

### Screens / States

1. **Empty state** — список файлов пуст: иконка + текст "No files uploaded yet" + кнопка "Upload file"
2. **Loading state** — загрузка списка: skeleton rows (3 анимированных прямоугольника)
3. **Upload progress** — прогресс-бар под загружаемым файлом в списке
4. **File list** — табличный/списочный вид: иконка типа, имя, размер, дата, действия (скачать/удалить)
5. **Error state** — ошибка загрузки: красное уведомление рядом с полем загрузки
6. **Preview** — inline аудиоплеер для audio/\*, видео-плеер для video/\*, иконка для документов

### Layout

- Секция "Files" на странице встречи под основной информацией
- Upload zone: `Dropzone` компонент с кликабельной областью + кнопка выбора файла
- Список файлов: строки с иконкой, именем, размером, датой, кнопками действий
- Аудио/видео превью: встроенный HTML5 `<audio>`/`<video>` плеер

### Accessibility

- Upload button имеет `aria-label="Upload file"`
- Кнопки действий: `aria-label="Download {filename}"`, `aria-label="Delete {filename}"`
- File list имеет `role="list"` с `aria-label="Meeting files"`
- Прогресс-бар имеет `role="progressbar"` с `aria-valuenow`
- Все интерактивные элементы доступны через Tab
- Подтверждение удаления через confirm dialog с focus trap

### Mobile Responsiveness

- На мобильных (≤ 640px) список переходит в карточный вид
- Upload zone адаптируется под ширину экрана
- Кнопки действий компактные (icon-only с aria-label)

### Loading States

- Загрузка списка: skeleton компонент (3 строки)
- Upload: `LinearProgress` компонент с процентом
- Download: spinner на кнопке скачивания (или иконка загрузки)
- Delete: spinner на кнопке удаления

### Error States

- Слишком большой файл: красный текст под дропзоной
- Неподдерживаемый тип: такой же inline error
- Сетевая ошибка: toast notification
- Ошибка удаления: toast notification + список остаётся без изменений

### Empty States

- Пустой список: иконка (upload-cloud или folder) + "No files yet" + кнопка "Upload your first file"

## 9. Data Model / Schema Changes

```prisma
model File {
  id           String   @id @default(uuid())
  originalName String
  mimeType     String
  size         Int      // bytes
  storagePath  String   // relative path: {userId}/{meetingId}/{uuid}-{sanitizedname}
  meetingId    String
  meeting      Meeting  @relation(fields: [meetingId], references: [id])
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Связи:
- Meeting → File: one-to-many
- User → File: one-to-many (ownership)

Индексы:
- `meetingId` для быстрого получения списка файлов встречи
- `userId` для изоляции по пользователю

## 10. API Contracts

| Method | Endpoint | Request | Response | Notes |
|--------|----------|---------|----------|-------|
| POST | `/api/v1/meetings/:meetingId/files` | `multipart/form-data` field `file` | `{ id, originalName, mimeType, size, createdAt }` | JWT required. Max 100MB |
| GET | `/api/v1/meetings/:meetingId/files` | — | `{ files: [{ id, originalName, mimeType, size, createdAt }] }` | JWT required. Список файлов встречи |
| GET | `/api/v1/meetings/:meetingId/files/:fileId/download` | — | Binary stream (Content-Disposition: attachment) | JWT required. Скачивание |
| GET | `/api/v1/meetings/:meetingId/files/:fileId/preview` | — | Binary stream (Content-Disposition: inline) | JWT required. Для встроенного просмотра |
| DELETE | `/api/v1/meetings/:meetingId/files/:fileId` | — | `{ message: 'File deleted' }` | JWT required. Ownership check |

Формат ошибок (единый):
```json
{
  "statusCode": 400,
  "message": "File size exceeds 100 MB limit",
  "error": "Bad Request"
}
```

## 11. Implementation Notes

### Modules to create/modify

**Backend (`apps/api/src/`):**
- `files/` — новый модуль (NestJS)
  - `files.controller.ts` — эндпоинты загрузки/списка/скачивания/удаления
  - `files.module.ts` — регистрация модуля
  - `files.service.ts` — бизнес-логика
  - `dto/` — DTO для валидации
  - `interceptors/file-upload.interceptor.ts` (опционально) — обработка multer
- `prisma/schema.prisma` — добавить модель File
- `app.module.ts` — импортировать FilesModule
- `package.json` — добавить `@nestjs/platform-express` (multer) если ещё нет

**Frontend (`apps/web/src/`):**
- `components/file-upload/` — новый компонент
  - `file-upload.tsx` — дропзона + кнопка загрузки
  - `file-list.tsx` — список файлов с действиями
  - `file-item.tsx` — строка файла (иконка, имя, размер, дата, действия)
  - `file-preview.tsx` — инлайн плеер (audio/video)
  - `file-upload.spec.tsx` — тесты
- Страница встречи — добавить секцию Files
- API helper для работы с файловыми эндпоинтами

### Key architectural decisions

1. **Хранение:** Локальная файловая система, путь `uploads/{userId}/{meetingId}/{uuid}-{sanitizedOriginalName}`. UUID предотвращает коллизии, sanitized name — path traversal.
2. **Streaming:** Для preview/download использовать `StreamableFile` из NestJS, не грузить файл в память целиком.
3. **Multer:** Использовать `@nestjs/platform-express` multer для обработки multipart upload с кастомным `FileInterceptor` и валидацией размера/типа.
4. **Удаление:** Сначала удаляем с диска, потом из БД. Если удаление с диска упало — не трогаем БД.
5. **Изоляция:** Все эндпоинты проверяют ownership — файл принадлежит пользователю через связь Meeting → User.
6. **Frontend `fetch` с `onUploadProgress`:** Использовать `XMLHttpRequest` или `fetch` с `ReadableStream` для прогресса (либо обёртку `axios`, если добавим в проект). Альтернатива — `navigator.sendBeacon` не подходит для прогресса.

### Dependencies

- **External:** `@nestjs/platform-express` (multer) — для multipart upload (уже есть в зависимостях NestJS)
- **External:** Prisma Client — генерация после изменения схемы
- **Internal:** AuthModule (JwtAuthGuard), MeetingModule (проверка существования встречи)

### Migration plan

1. Добавить модель File в schema.prisma
2. `npx prisma migrate dev --name add_file_model` — создание миграции
3. `npx prisma generate` — генерация клиента

### Feature flags

Не требуется — фича включается сразу после деплоя.

## 12. Testing Strategy

| Type | Scope | Approach |
|------|-------|----------|
| Unit | FileService | Mock PrismaService, test CRUD logic, ownership checks |
| Unit | FileController | Test validation, guards, response shapes |
| Integration | Upload endpoint | Supertest + TestingModule: upload valid/invalid files, verify size/type checks |
| Integration | Download endpoint | Supertest: download existing/non-existing file, verify Content-Disposition |
| Integration | Delete endpoint | Supertest: delete own file, delete other's file (403), cleanup disk |
| Unit (frontend) | FileUpload component | RTL: render empty/loading/list/error states, simulate upload |
| Unit (frontend) | FileList component | RTL: render files, click delete/download, confirm dialog |
| E2E | Full flow | Playwright: login → open meeting → upload file → see in list → delete |

### Seams
- `PrismaService` — mocking point для всех DB-операций
- `Multer` — можно замокать через `@nestjs/testing`
- `FileService` можно тестировать без диска, инжектя storage provider

### Prior art
- Auth module tests: `apps/api/src/auth/commands/register.handler.spec.ts`
- User module tests: `apps/api/src/user/user.service.spec.ts`
- Frontend tests: `apps/web/src/components/header.spec.tsx`, `apps/web/src/contexts/auth-context.spec.tsx`

## 13. Edge Cases & Failure Modes

- **Файл 0 байт** → отклонить с ошибкой "Empty file"
- **Превышение лимита 100 MB** → отклонить до сохранения на диск
- **Неподдерживаемый MIME type** → отклонить с сообщением о разрешённых типах
- **Спецсимволы в имени файла** → санитизировать: `../../../etc/passwd` → экранированный uuid-based имя
- **Одновременная загрузка в одну встречу** → multer handles concurrency, Prisma serializes writes
- **Удаление несуществующего файла** → 404 Not Found
- **Удаление файла другого пользователя** → 403 Forbidden
- **Загрузка без JWT** → 401 Unauthorized
- **Диск сервера переполнен** → 507 Insufficient Storage с осмысленным сообщением
- **Скачивание несуществующего файла** → 404
- **Файл с диска удалён вручную (out of sync)** → 404 при попытке скачать, опция перезагрузить
- **Повторная загрузка файла с тем же именем** → сохранить как отдельный файл (uuid в имени)
- **Очень длинное имя файла (>255 символов)** → обрезать при сохранении

## 14. Success Metrics

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| Upload success rate | N/A | > 99% | Logs: успешные / всего попыток |
| Average upload time (10 MB file) | N/A | < 5s при 100 Mbps | APM / лог времени |
| Upload error rate (validation) | N/A | < 5% | Logs: validation errors / total |
| File storage used | 0 MB | < 5 GB after 1 month | Disk usage monitor |
| User engagement with file feature | N/A | > 60% of meetings have files | DB query: meetings with files / total |

## 15. Open Questions

- **Нужно ли антивирусное сканирование загружаемых файлов?** — Owner: product / Status: TBD
- **Нужен ли MaxMind/гео-лимит для загрузки?** — Owner: product / Status: TBD
- **Сжатие/ресайз изображений при загрузке?** — Owner: product / Status: TBD (если будут image files)
- **Rate limiting на upload эндпоинт?** — Owner: backend / Status: TBD

## 16. Dependencies

- **External:** `@nestjs/platform-express` — для multer integration
- **Internal:** Meeting module — проверка существования встречи
- **Internal:** Auth module — JwtAuthGuard
- **Pre-requisites:** Создание `uploads/` директории в проекте (gitignored)

## 17. Release Plan

| Phase | Scope | Timeline | Success Criteria |
|-------|-------|----------|------------------|
| P1 (MVP) | Upload, list, download, delete. Basic file validation. Local storage. | Sprint N | All P0 stories pass. API tests green. |
| P2 | Inline preview (audio/video), upload progress, improved empty/error states | Sprint N+1 | All P1 stories pass. Frontend tests green. |

## 18. Out of Scope

- Транскрибация и AI-анализ файлов
- Редактирование файлов
- Шаринг файлов
- S3/облачное хранение
- Drag-and-drop upload (только в рамках стандартной дропзоны)
- Версионирование файлов
- Комментарии к файлам
- Полнотекстовый поиск по содержимому

## 19. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Multipart upload | Загрузка файла через HTTP запрос с Content-Type multipart/form-data |
| MIME type | Стандартный идентификатор формата данных (audio/mpeg, video/mp4, application/pdf) |
| Sanitisation | Очистка имени файла от специальных символов и path traversal попыток |
| Ownership | Принадлежность ресурса конкретному пользователю |

### References

- [NestJS File Upload docs](https://docs.nestjs.com/techniques/file-upload) — multer integration
- [HeroUI Progress](https://heroui.com/docs/components/progress) — компонент прогресс-бара
- [HTML5 Audio element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) — inline плеер
- [HTML5 Video element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video) — inline плеер
- [NestJS StreamableFile](https://docs.nestjs.com/techniques/streaming-files) — streaming download
- Prior art в проекте: `apps/api/src/meetings/` — структура модуля, `apps/web/src/app/login/page.tsx` — UI patterns с HeroUI

### Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-07-30 | AI Assistant | Initial draft |
