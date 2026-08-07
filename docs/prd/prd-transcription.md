# PRD: Local Whisper Transcription for Meeting Files

> **Статус:** Draft
> **Автор:** AI Assistant
> **Дата:** 2026-08-07

---

## 1. Executive Summary

Автоматическая транскрибация загружаемых во встречу аудио (mp3) и видео (mp4) файлов локальной моделью Whisper (whisper.cpp, модель `base`) на CPU. После загрузки файл попадает в фоновую очередь, пользователь видит статус транскрибации (Ожидает / Обрабатывается с прогрессом / Готово / Ошибка) и может открыть готовый текст транскрипта под файлом. Никакие данные не покидают сервер — всё работает локально.

## 2. Problem Statement

- **Текущая ситуация:** загрузка файлов во встречу работает (`MeetingFile` в БД, локальное хранение в `uploads/`), но загруженные mp3/mp4 нигде не обрабатываются. Транскрибация была явно отложена (NG1 в `docs/prd/prd-file-upload.md`).
- **Боли пользователя:** чтобы получить текст встречи, пользователь вынужден скачивать запись и транскрибировать её сторонними инструментами, часто отправляя данные в облачные сервисы. Нет связи «файл → его текст» в одном месте.
- **Возможность:** ядро meeting intelligence: из записи рождается текстовый артефакт, который станет основой для последующих фич (суммаризация, поиск, AI-анализ). Усиливает приватность: обработка на своём сервере.

## 3. Goals & Non-Goals

### Goals

- G1: Загруженный mp3/mp4 автоматически транскрибируется локальной моделью Whisper `base` без участия пользователя
- G2: Пользователь видит актуальный статус транскрибации и прогресс (0–100%) в реальном времени
- G3: Готовый текст транскрипта отображается под файлом на странице встречи
- G4: При ошибке транскрибации пользователь может повторить попытку без повторной загрузки файла
- G5: Транскрибация не блокирует API: фоновые задачи с ограничением конкуренции

### Non-Goals

- NG1: Diarization (разделение говорящих)
- NG2: Таймкоды/сегменты в UI (хранение plain-текста, P2 — сегменты)
- NG3: Суммаризация и AI-анализ транскрипта
- NG4: Перевод транскрипта
- NG5: GPU/CUDA (только CPU; флаг `withCuda` — на будущее)
- NG6: Потоковая транскрибация в реальном времени
- NG7: Очередь на базе Redis/BullMQ (только in-process, P2 — персистентная очередь)

## 4. User Personas

| Персона | Роль | Потребности |
|---------|------|-------------|
| Алексей | Product Manager | Загружает записи встреч, хочет видеть текст разговора без выноса данных наружу |
| Елена | Team Lead | Загружает записи стендапов, хочет понимать, обработан файл или нет, и открыть текст |

## 5. User Stories

1. **P0** As a user, I want my uploaded mp3/mp4 file to be transcribed automatically, so that I get the text without extra steps.
2. **P0** As a user, I want to see the transcription status and progress of each file, so that I know whether the text is ready.
3. **P0** As a user, I want to open the transcript text under the file, so that I can read what was said.
4. **P0** As a user, I want to retry a failed transcription, so that I can get the text after a transient error.
5. **P1** As a user, I want to see the error reason when transcription fails, so that I understand what went wrong.

## 6. Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-1 | После успешной загрузки файла с MIME `audio/*` или `video/*` автоматически ставить статус `PENDING` и ставить задачу в очередь | P0 | US-1 |
| FR-2 | Файлы других типов (pdf/doc) не транскрибируются: `transcriptionStatus = null` | P0 | US-1 |
| FR-3 | Очередь обрабатывает задачи последовательно с лимитом конкуренции (env `TRANSCRIPTION_CONCURRENCY`, дефолт 1) | P0 | US-1 |
| FR-4 | Перед началом обработки статус → `PROCESSING` | P0 | US-2 |
| FR-5 | Обновлять прогресс (0–100%) из whisper.cpp (строки `progress = N%` в stderr) | P0 | US-2 |
| FR-6 | По завершении сохранить текст транскрипта, статус → `COMPLETED`, записать `transcribedAt` и детектированный язык | P0 | US-3 |
| FR-7 | При ошибке статус → `FAILED` + сохранить причину (`transcriptionError`) | P0 | US-4, US-5 |
| FR-8 | Эндпоинт повторной попытки: `POST …/files/:fileId/transcription/retry` — статус `FAILED` → `PENDING` и повторное взятие в очередь | P0 | US-4 |
| FR-9 | Список файлов встречи отдаёт статус и прогресс каждого файла | P0 | US-2 |
| FR-10 | Эндпоинт получения транскрипта `GET …/files/:fileId/transcript` — отдаёт текст только для `COMPLETED` (иначе 409) | P0 | US-3 |
| FR-11 | UI показывает статус/прогресс в строке файла и обновляет их по таймеру (polling ~3s), пока идёт обработка | P0 | US-2 |
| FR-12 | UI показывает блок транскрипта под файлом по кнопке «Показать транскрипт» | P0 | US-3 |
| FR-13 | UI показывает кнопку «Повторить» для `FAILED` файлов | P0 | US-4 |
| FR-14 | Восстановление после рестарта: на старте приложения все `PROCESSING` → `FAILED` (причина «прервано перезапуском») | P0 | US-4 |
| FR-15 | При удалении файла во время обработки задача отменяется корректно (строка уже удалена) | P0 | US-1 |
| FR-16 | Язык распознавания — автоопределение (whisper `-l auto`) | P1 | US-3 |
| FR-17 | Пустой транскрипт (речь не распознана) → `COMPLETED` с пустым текстом; UI показывает «Речь не распознана» | P1 | US-3 |

## 7. Non-Functional Requirements

| ID | Requirement | Category | Target |
|----|-------------|----------|--------|
| NFR-1 | Транскрибация не блокирует event loop: whisper.cpp работает дочерним процессом | Performance | API отвечает во время обработки |
| NFR-2 | Конкуренция транскрибаций | Performance | 1–2 параллельные задачи на CPU (env) |
| NFR-3 | Прогресс видим пользователю | UX | Обновление статуса ≤ 3s (polling) |
| NFR-4 | Обработка целиком локально, данные не отправляются наружу | Security | Нет сетевых вызовов кроме загрузки модели (одноразово) |
| NFR-5 | Доступ к транскрипту и повторной попытке только владельцу файла (JWT + ownership) | Security | 401 без токена, 404 для чужого файла |
| NFR-6 | Никаких секретов в env-файлах и репозитории | Security | Модель и конфиг — не секреты, публикуются в `.env.example` |
| NFR-7 | Пути к wav/txt не выходят за `UPLOAD_DIR` | Security | Reuse `resolveStoredPath` guard из FilesService |
| NFR-8 | Статус и прогресс доступны скринридеру | UX/Accessibility | `role="status"` / `aria-live="polite"` на бейдже, `role="progressbar"` на прогресс-баре |
| NFR-9 | Кнопки «Повторить»/«Показать транскрипт» ≥ 44×44px и доступны с клавиатуры | UX/Accessibility | `min-h-11`, Tab/Space/Enter |
| NFR-10 | Статус никогда не «зависает»: рестарт переводит `PROCESSING` → `FAILED` | Reliability | boot-recovery запрос в `onModuleInit` |
| NFR-11 | Нет утечки временных файлов: wav и txt удаляются после обработки | Reliability | cleanup в finally обработчика задачи |
| NFR-12 | Ошибки ffmpeg/модели/whisper возвращаются как понятные пользовательские причины | UX | Сообщение в `transcriptionError` (ключ, переводится на фронте) |

## 8. UI/UX Design

### Screens / States

1. **Pending** — бейдж «Ожидает транскрибации» (серая плашка) в строке файла
2. **Processing** — `ProgressBar` с процентами + текст «Транскрибация… 45%»
3. **Completed** — бейдж «Готово» (зелёная плашка) + кнопка «Показать транскрипт»
4. **Failed** — бейдж «Ошибка» (красная плашка) + причина + кнопка «Повторить»
5. **Transcript open** — раскрывающийся блок под строкой файла с текстом транскрипта
6. **Transcript empty** — «Речь не распознана» с пояснением
7. **Transcript loading/error** — спиннер / сообщение об ошибке внутри блока

### Layout

- В строке файла (`FileItem`) под метаданными добавляется строка статуса транскрибации
- Блок транскрипта — раскрывающийся панель под превью файла (аналогично существующему `FilePreview`)
- Текст транскрипта — абзацы (`whitespace-pre-wrap`), не длиннее ширины контейнера (переносы слов)

### Accessibility

- Бейдж статуса: `role="status"` + `aria-live="polite"` (прогресс и переходы озвучиваются)
- Прогресс-бар: HeroUI v3 `ProgressBar` (aria `role="progressbar"`, `aria-valuenow` при детерминированном, ommit при indeterminate)
- Кнопки «Показать транскрипт»/«Повторить»: `aria-label` с именем файла, ≥ 44×44 (`min-h-11`)
- Контраст: тексты статусов ≥ 4.5:1 (semantic tokens: `success`/`danger`/`muted`, не raw hex)
- Все интерактивные элементы доступны через Tab, `onPress` вместо `onClick`

### Mobile Responsiveness

- На ≤ 640px статус-строка переносится на новую строку под метаданными, кнопки остаются icon-only с aria-label
- Прогресс-бар растягивается на всю ширину строки

### Loading States

- Статус/прогресс обновляются polling-ом (индикатор не «моргает»: обновление только при изменении значения)
- Открытие транскрипта: спиннер внутри блока (как в `FilePreview`)

### Error States

- Причина ошибки рядом со статусом файла (не только toast): «Не удалось начать транскрибацию: ffmpeg не найден» и т.п.
- Ошибка сети при polling: статус остаётся последним известным, повторная попытка на следующем тике
- Ошибка получения транскрипта: сообщение внутри блока транскрипта

### Empty States

- Транскрипт готов, но пуст: «Речь не распознана. Проверьте качество записи.»

## 9. Data Model / Schema Changes

```prisma
enum TranscriptionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model MeetingFile {
  id                    String               @id @default(uuid(7))
  storagePath           String               @unique
  originalName          String
  mimeType              String
  size                  Int
  createdAt             DateTime             @default(now())
  meetingId             String
  userId                String
  meeting               Meeting              @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  user                  User                 @relation(fields: [userId], references: [id])

  // Transcription
  transcriptionStatus   TranscriptionStatus? // null = не применимо (не audio/video)
  transcriptionProgress Int?                 // 0..100, null до старта
  transcriptionError    String?              // причина, только для FAILED
  transcript            String?              // полный текст
  transcriptionLanguage String?              // детектированный код языка (ISO 639-1)
  transcribedAt         DateTime?

  @@index([userId, meetingId])
  @@index([meetingId])
  @@index([transcriptionStatus])
}
```

Семантика:
- `transcriptionStatus = null` — файл не транскрибируется (pdf/doc) или транскрибация ещё не запущена (обратная совместимость).
- Для mp3/mp4 статус выставляется `PENDING` сразу при создании записи файла.
- `transcript` хранится прямо в строке файла (1:1), отдельная модель не нужна для MVP.

Индекс `@@index([transcriptionStatus])` — для boot-recovery запроса (`PROCESSING` на старте).

## 10. API Contracts

| Method | Endpoint | Request | Response | Notes |
|--------|----------|---------|----------|-------|
| POST | `/meetings/:meetingId/files` | `multipart/form-data` field `file` | `{ id, originalName, mimeType, size, createdAt, transcriptionStatus, transcriptionProgress }` | Существующий. Для audio/video ответ включает `transcriptionStatus: "PENDING"` |
| GET | `/meetings/:meetingId/files` | — | `{ files: [{ id, originalName, mimeType, size, createdAt, transcriptionStatus, transcriptionProgress }] }` | Существующий. Добавлены поля транскрибации (без текста — он тяжёлый) |
| GET | `/meetings/:meetingId/files/:fileId/transcript` | — | 200: `{ transcript, language, transcribedAt }` · 409: `{ statusCode: 409, message: "Transcription not completed" }` | JWT + ownership. Текст только для `COMPLETED` |
| POST | `/meetings/:meetingId/files/:fileId/transcription/retry` | — | 202: `{ transcriptionStatus: "PENDING" }` · 400: если уже `PENDING`/`PROCESSING` · 404: файл не найден/чужой | JWT + ownership. Только для `FAILED` |

Формат ошибок — единый (как в проекте):
```json
{ "statusCode": 409, "message": "Transcription not completed", "error": "Conflict" }
```

Сообщения API — английские стабильные ключи, перевод на русский — `translateApiError` (`apps/web/src/lib/api-errors.ts`).

## 11. Implementation Notes

### Modules to create/modify

**Backend (`apps/api/src/`):**
- `transcription/` — новый модуль:
  - `transcription.module.ts` — регистрация, импорт AuthModule (JwtAuthGuard), Prisma (глобальный)
  - `transcription.service.ts` — in-process очередь, жизненный цикл задачи, статусные переходы, boot-recovery
  - `transcription.controller.ts` — `GET …/transcript`, `POST …/transcription/retry`
  - `whisper-engine.ts` — обёртка над `nodewhisper()` (инжектируемый интерфейс `WHISPER_ENGINE`), сбор прогресса через logger
  - `progress.parser.ts` — парсер строк `progress = N%` из stderr whisper.cpp
  - `transcription.constants.ts` — токены `WHISPER_ENGINE`, `WHISPER_MODEL_DIR`, env-парсинг
- `files/files.service.ts` — после upload: если mime `audio/*`|`video/*` → создать запись с `transcriptionStatus: PENDING` и вызвать `transcriptionService.enqueue(fileId)`
- `files/files.module.ts` — импортировать TranscriptionModule
- `app.module.ts` — импортировать TranscriptionModule
- `prisma/schema.prisma` — enum + поля (см. §9) + миграция
- `package.json` — добавить `nodejs-whisper` (dependencies), `@types/…` при необходимости

**Frontend (`apps/web/src/`):**
- `components/file-upload/file-upload.tsx` — расширить `MeetingFile` полями транскрибации
- `components/file-upload/file-list.tsx` — polling статусов (setInterval 3s), пока есть `PENDING`/`PROCESSING`
- `components/file-upload/file-item.tsx` — строка статуса, кнопки «Показать транскрипт»/«Повторить»
- `components/file-upload/transcription-status.tsx` (новый) — бейдж/прогресс по статусу
- `components/file-upload/transcript-panel.tsx` (новый) — блок текста транскрипта (fetch, loading/error/empty)
- `lib/api-errors.ts` — перевод новых ключей ошибок
- Страница встречи — без изменений (секция уже есть)

### Key architectural decisions

1. **Движок — `nodejs-whisper` (whisper.cpp).** Нативные биндинги, оптимизированы под CPU/Apple Silicon, сами конвертируют mp3/mp4 → WAV 16kHz (ffmpeg) и отдают прогресс в stderr (`progress = N%` → logger.debug). Модель `base` (~74 MB, multi-language, автоопределение языка).
2. **In-process очередь вместо Redis.** Транскрибация — локальная, CPU-bound, whisper.cpp работает дочерним процессом (shelljs/child_process), поэтому event loop API свободен. Простой FIFO-контейнер + лимит конкуренции (`TRANSCRIPTION_CONCURRENCY`). P2 — переезд на BullMQ при необходимости масштабирования.
3. **Межмодульная связь — прямая инъекция `TranscriptionService` в FilesService** (однонаправленный вызов `enqueue(fileId)`), без EventBus. Соответствует правилу проекта «простой CRUD — Service».
4. **Прогресс из stderr:** передаём кастомный `logger` (с интерфейсом `Console`) в `nodewhisper()`, ловим `logger.debug` строки, парсим `/progress\s*=\s*(\d+)\s*%/` → `transcriptionProgress`.
5. **Хранение текста:** читаем сгенерированный whisper `{wav}.txt`, кладём в `transcript`, удаляем временные `.wav`/`.txt` (wav убирает `removeWavFileAfterTranscription: true`).
6. **`WHISPER_ENGINE` инжектируется** (аналог `MIME_TYPE_DETECTOR` в files-модуле) — e2e-тесты подменяют его стабом без реальной транскрибации.
7. **Boot-recovery:** в `onModuleInit` помечаем `PROCESSING` → `FAILED` (причина «Interrupted by server restart»). Воркер на старте не подхватывает «висячие» задачи.
8. **Warm-up на старте:** первая транскрибация инициирует cmake-сборку whisper-cli (несколько минут). Чтобы сборка не происходила на первом запросе — вызываем warm-up при `onModuleInit` (в фоне) и документируем сборку в деплой-инструкции.

### Dependencies

- **External (runtime):** `nodejs-whisper` (npm, `^0.3.x`)
- **External (system):** `ffmpeg` на PATH (конвертация в WAV 16kHz); cmake + C/C++ toolchain (Xcode CLT на macOS) для сборки whisper.cpp; модель `ggml-base.bin` (~74 MB, скачивается при первом запуске через `autoDownloadModelName` или заранее `npx nodejs-whisper download`)
- **Internal:** FilesModule (триггер загрузки), PrismaService, AuthModule (JwtAuthGuard), `UPLOAD_DIR`
- **Pre-requisites:** установить ffmpeg и собрать/скачать модель перед включением фичи в проде

### Migration plan

1. Добавить enum и поля в `schema.prisma`
2. `npx prisma migrate dev --name add_transcription` в `apps/api` + `prisma generate`
3. `npm install` (ставится `nodejs-whisper`)
4. Установка системных зависимостей (ffmpeg, cmake)

### Feature flags

Не требуется — фича включается сразу. Для мягкого запуска можно гейтить через env `TRANSCRIPTION_ENABLED` (по умолчанию `true`).

## 12. Testing Strategy

| Type | Scope | Approach |
|------|-------|----------|
| Unit | `progress.parser.ts` | Парсинг строк `progress = N%`, мусор, мультилайн |
| Unit | `TranscriptionService` | Стабы `WHISPER_ENGINE` + Prisma: переходы статусов, конкуренция, ошибки, cleanup временных файлов |
| Unit | `TranscriptionService` recovery | `onModuleInit` переводит `PROCESSING` → `FAILED` |
| Integration (api e2e) | Upload → транскрибация | Supertest + стаб `WHISPER_ENGINE`: загрузка mp3 → `PENDING` → задача выполнена → `COMPLETED` + текст; pdf → статус `null` |
| Integration (api e2e) | transcript/retry эндпоинты | 404 для чужого файла, 409 пока не `COMPLETED`, 400 при повторном retry, 202 → `PENDING` |
| Unit (frontend) | `TranscriptionStatus`/`TranscriptPanel` | RTL: статусы, прогресс, пустой транскрипт, ошибка, retry-клик |
| Unit (frontend) | `FileList` polling | fake timers: опрос прекращается, когда нет активных задач |
| E2E (web) | Полный flow | Playwright: upload mp3 → бейдж статуса → (стаб на уровне route/api) → текст транскрипта |

### Seams

- `WHISPER_ENGINE` — основной seam: тесты подменяют реальный `nodewhisper()` стабом, который «мгновенно» возвращает текст (аналог `MIME_TYPE_DETECTOR` в `files.e2e-spec.ts`)
- `PrismaService` — mock всех DB-операций в unit-тестах
- `ffmpeg`/модель — не участвуют в тестах (только в реальном движке)

### Prior art

- `apps/api/test/files.e2e-spec.ts` — паттерн загрузки файла, ownership (404), мок движка
- `apps/api/src/files/` — паттерн инжектируемого детектора, `UPLOAD_DIR`, `resolveStoredPath`
- `apps/web/src/components/file-upload/*` — компоненты списка/превью, состояния загрузки
- `apps/web/src/lib/api-errors.ts` — перевод ошибок API

## 13. Edge Cases & Failure Modes

- **Файл без речи (тишина/музыка)** → whisper возвращает пусто → `COMPLETED` + пустой `transcript`, UI: «Речь не распознана»
- **mp4 без аудиодорожки** → ffmpeg не даёт WAV → `FAILED` с причиной «No audio stream»
- **ffmpeg не установлен** → `FAILED` «ffmpeg not found» (проверка перед задачей)
- **Модель не скачана** → warm-up при старте; при отсутствии → задача `FAILED` с понятной причиной + инструкция в лог
- **Файл удалён во время обработки** → на старте задачи проверяем существование строки; если нет — пропускаем
- **Рестарт сервера во время обработки** → boot-recovery: `PROCESSING` → `FAILED` «Interrupted by server restart» (пользователь жмёт «Повторить»)
- **Пустой/повреждённый аудиофайл** → `FAILED` с причиной от whisper/ffmpeg
- **Очень длинная запись (2h+)** → задача выполняется долго, прогресс отображается; лимита на длительность нет (MVP)
- **Много одновременных загрузок** → очередь с `TRANSCRIPTION_CONCURRENCY`; новые задачи встают в FIFO
- **Ошибка сети при polling** → фронт сохраняет последний известный статус, следующий тик повторяет запрос
- **Два retry подряд** → второй retry в `PROCESSING`/`PENDING` вернёт 400
- **Чужой файл / чужая встреча** → 404 (конвенция проекта, не 403)

## 14. Success Metrics

| Metric | Current | Target | How to measure |
|--------|---------|--------|----------------|
| Доля mp3/mp4, дошедших до `COMPLETED` | 0% | > 95% | БД: completed / всего audio-video файлов |
| Доля задач, «зависших» в `PROCESSING` > 1h | — | 0% | БД + boot-recovery лог |
| Средняя скорость транскрибации | — | ≥ 5× реального времени (base, CPU) | Лог времени задачи vs длительности аудио |
| Retry rate | — | < 10% задач | БД: retry-вызовы / completed |
| Время до появления прогресса после upload | — | < 5s | E2E/ручная проверка |
| Engagement: файлов с открытым транскриптом | 0% | > 50% завершённых | Лог события открытия транскрипта |

## 15. Open Questions

- **Сборка whisper-cli при первом запуске** — собственноручно в деплой-скрипте или полагаться на lazy-build + warm-up? — Owner: backend / Status: TBD (рекомендую warm-up + явный шаг в деплой-доке)
- **Скачивание модели** — `autoDownloadModelName` при первом запуске (нужен сетевой доступ на деплой) или явный `npm run whisper:download`? — Owner: backend / Status: TBD
- **Сегменты с таймкодами** — нужны ли в этой итерации (P2), или plain text достаточен? — Owner: product / Status: P2
- **Показывать ли детектированный язык** пользователю — Owner: product / Status: TBD

## 16. Dependencies

- **External:** `nodejs-whisper@^0.3` (npm), `ffmpeg` (системный, brew), cmake + C++ toolchain, модель `ggml-base.bin` (~74 MB)
- **Internal:** FilesModule (триггер), AuthModule (JwtAuthGuard), PrismaService, `UPLOAD_DIR`
- **Pre-requisites:** миграция БД, установка ffmpeg, наличие модели

## 17. Release Plan

| Phase | Scope | Timeline | Success Criteria |
|-------|-------|----------|------------------|
| P1 (MVP) | Пайплайн (очередь, статусы, прогресс), текст под файлом, retry, polling, boot-recovery, e2e со стабом движка | Sprint N | Все P0 stories зелёные, unit+e2e проходят, статусы не зависают |
| P2 | Сегменты с таймкодами, отображение языка, персистентная очередь (BullMQ+Redis), diarization research | Sprint N+1 | P1 stories + сегментированный транскрипт |

## 18. Out of Scope

- Diarization и определение спикеров
- Таймкоды/сегменты в UI (P2)
- Суммаризация, AI-анализ, поиск по транскрипту
- Перевод транскрипта
- GPU/CUDA-инференс
- Потоковая транскрибация
- Персистентная очередь (Redis/BullMQ) — P2
- S3/облачное хранение файлов

## 19. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Транскрибация | Преобразование аудио/видео записи в текст |
| Whisper | Модель распознавания речи OpenAI |
| whisper.cpp | С++ реализация Whisper, оптимизированная под CPU |
| `nodejs-whisper` | Node.js биндинги к whisper.cpp |
| `ggml-base.bin` | Файл модели «base» в формате GGML (~74 MB) |

### References

- [nodejs-whisper (npm)](https://www.npmjs.com/package/nodejs-whisper) — API: `nodewhisper(filePath, { modelName, modelRootPath, autoDownloadModelName, whisperOptions, logger })`, флаги `-otxt`/`-ojf`, прогресс в stderr
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — модель и CLI
- [ffmpeg](https://ffmpeg.org/) — конвертация в WAV 16kHz mono
- Prior art: `apps/api/src/files/` (инжектируемый детектор, `UPLOAD_DIR`), `apps/api/test/files.e2e-spec.ts`, `apps/web/src/components/file-upload/`
- Решения по стеку подтверждены интервью (2026-08-07): nodejs-whisper + модель base + автоопределение языка + in-process очередь + статус и текст под файлом

### Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-08-07 | AI Assistant | Initial draft |
