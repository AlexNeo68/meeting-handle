# Research: File Upload for Meetings — Best Practices

> **Source:** `docs/plans/plan-file-upload.md`, `docs/prd/prd-file-upload.md`
> **Date:** 2026-07-31
> **Status:** Ready for implementation
> **Scope:** Backend (NestJS 10 + Prisma 7) + Frontend (Next.js 15 + HeroUI v3)

---

## 1. Executive Summary

Research on how to build the file-upload feature per `plan-file-upload.md` following current best practices. All findings verified against primary sources and the installed dependencies in this repo.

**Key decisions (deviations from the plan):**

| # | Topic | Plan said | Research says | Why |
|---|-------|-----------|---------------|-----|
| D1 | Oversize upload status | e2e expects **400** | **413** `PayloadTooLargeException` | Nest's `transformException` already maps `LIMIT_FILE_SIZE` → 413. Free, correct, no custom code. |
| D2 | Storage | Disk storage | **Disk storage confirmed** | Memory storage buffers 100 MB per request in RAM → OOM risk under concurrency. |
| D3 | StreamableFile for preview | Both download & preview use `StreamableFile` | Download → `StreamableFile`; **preview → `res.sendFile({ acceptRanges: true })`** | `StreamableFile` sets only `Content-Type`/`Content-Disposition`/`Content-Length`. No `Accept-Ranges`/206 → video/audio scrubber won't seek. Express `send` implements RFC 7233. |
| D4 | Delete order | Disk first, then DB | **DB row first, then `unlink` in try/catch** + orphan sweeper | Delete-first leaves the app serving rows whose file is gone (the worse failure state). Orphan sweeper resolves disk leaks from crashes. |
| D5 | Model name | `File` (open question) | **`MeetingFile`** | Avoids shadowing Node/DOM `File` global; clearer imports. |
| D6 | MIME validation | Deferred to P2 (open question) | **Do magic-bytes check in T1/P1**, but inject the detector (ESM caveat) | `Content-Type` is client-set and spoofable. The only caveat is `file-type` is ESM-only and breaks in the CJS ts-jest e2e runner → make it injectable. |
| D7 | Multer | — (not mentioned) | **Root `overrides: { "multer": "^2.2.0" }`** | Installed `multer@2.0.2` has 9 published advisories. Override fixes them without pulling Nest 11 (breaking). Also fixes Cyrillic filename mangling. |
| D8 | HeroUI progress | `<Progress>` | **`ProgressBar`** (v3 name) | HeroUI v3 renamed the component; `Progress` is not exported. |

---

## 2. Verified Dependency Facts

Checked against installed `node_modules` (2026-07-31):

| Package | Installed | Note |
|---------|-----------|------|
| `@nestjs/platform-express` | 10.4.22 | Pins `multer@2.0.2` (exact). |
| `multer` | **2.0.2** | 9 published advisories; `^2.2.0` (2026-06-15) resolves them. Root `overrides` is the fix. |
| `@nestjs/common` | 10.4.22 | Depends on `file-type@20.4.1` (pure ESM). |
| `@heroui/react` | 3.2.2 | Exports `progress-bar`, `progress-circle`, `alert-dialog`, `modal`, `table`. **No `Progress`, no `DropZone`.** |
| `react-aria-components` | 1.19.0 | Transitive dep of `@heroui/react` — gives us `DropZone`, `FileTrigger` for free. |
| `@types/multer` | **not installed** | Must add (`^2.2.0`). |
| API build | CommonJS (ts-jest CJS e2e) | Dynamic `import('file-type')` fails in Jest sandbox without `--experimental-vm-modules`. |

**Action items before implementation:**
1. Root `package.json`: `"overrides": { "multer": "^2.2.0" }` → `npm install`
2. `npm i -D -w apps/api @types/multer@^2.2.0`
3. Decide e2e ESM strategy (D6): add `--experimental-vm-modules` to `test:e2e` **or** inject the detector so tests stub it.

---

## 3. Backend Research

### 3.1 Multer integration (T1)

- Use **`diskStorage`** — not `memoryStorage`. Files up to 100 MB buffered in RAM risk OOM under the NFR-2 requirement (3 concurrent uploads).
- Set explicit `limits: { fileSize: 100 * 1024 * 1024, files: 1 }` — multer's default `fileSize` is `Infinity`.
- `fileFilter` is a cheap pre-gate only (`file.mimetype` is client-set). Authoritative check = magic bytes (3.5).
- Guards run **before** interceptors in the Nest request lifecycle, so the `destination` callback can read `req.user` — JWT is already resolved. Build `uploads/{userId}/{meetingId}/` there.
- `destination` does **not** create directories — call `mkdirSync(dir, { recursive: true })` yourself.
- Stored filename: `randomUUID() + <whitelisted extension>` — never derived from user input (3.4).

```ts
// apps/api/src/files/upload.options.ts
export const multerDiskOptions = (): MulterOptions => ({
  storage: diskStorage({
    destination: (req, file, cb) => {
      const dir = join(UPLOAD_DIR, req.user!.sub, req.params.meetingId);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) =>
      cb(null, `${randomUUID()}${extname(sanitizeOriginalName(file.originalname))}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED_MIME.has(file.mimetype)
      ? cb(null, true)
      : cb(new BadRequestException('Unsupported file type'), false),
});
```

```ts
// apps/api/src/files/files.controller.ts
@Post(':meetingId/files')
@UseInterceptors(FileInterceptor('file', multerDiskOptions()))
async upload(
  @UploadedFile(new ParseFilePipe({
    validators: [new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 })],
  })) file: Express.Multer.File,
  @Param('meetingId', ParseUUIDPipe) meetingId: string,
  @UserId() userId: string,
) { /* ownership check + magic bytes + DB row */ }
```

Sources:
- https://docs.nestjs.com/techniques/file-upload
- https://github.com/expressjs/multer#disk-storage
- https://docs.nestjs.com/faq/request-lifecycle

### 3.2 Error handling (T1, NFR-11)

Nest's `transformException` (verified in `node_modules/@nestjs/platform-express/multer/multer/multer.utils.js`) already maps:

| Multer error | HTTP |
|--------------|------|
| `LIMIT_FILE_SIZE` | **413** `PayloadTooLargeException` |
| `LIMIT_FILE_COUNT`, `LIMIT_FIELD_*`, `LIMIT_UNEXPECTED_FILE`, `MISSING_FIELD_NAME` | **400** |
| `MULTIPART_*` (bad boundary/part header) | **400** `"Multipart: …"` |
| everything else | passes through → 500 |

What's missing is **disk-full**: add a global `AllExceptionsFilter` mapping `ENOSPC` → **507**, `ENOENT` → **404**, other fs errors → 500 (generic body, no internals leaked). The plan's NFR-11 (507) has no implementation path otherwise.

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    const code = (exception as NodeJS.ErrnoException)?.code;
    const status = code === 'ENOSPC' ? 507 : code === 'ENOENT' ? 404 : 500;
    res.status(status).json({
      statusCode: status,
      message: status === 507 ? 'Insufficient storage' : 'Internal server error',
    });
  }
}
```

Note: multer itself aborts the busboy stream and `_removeFile`s the partial on error, but cleanup is only fully correct from 2.2.0 (GHSA-3p4h-7m6x-2hcm) — another reason for D7.

Sources:
- https://docs.nestjs.com/exception-filters
- https://github.com/nestjs/nest/blob/master/packages/platform-express/multer/multer/multer.utils.js
- https://github.com/expressjs/multer/blob/master/lib/make-middleware.js

### 3.3 Streaming download & preview (T2, FR-8, US-5)

- `StreamableFile` (verified in `streamable-file.js`) sets only `Content-Type`, `Content-Disposition`, `Content-Length`. **No `Accept-Ranges`/206.** Fine for whole-file download; useless for inline video seeking.
- For **preview** (`GET …/preview`, audio/video inline player), use `res.sendFile(absPath, { acceptRanges: true, dotfiles: 'deny' })`. Express `send` implements RFC 7233 — sets `Accept-Ranges: bytes`, returns **206** for `Range` requests, plus `If-Range`/`If-Modified-Since`/ETag. Verified in installed `send/index.js`.
- **404 on missing file:** resolve ownership + existence in the service (`NotFoundException`) *before* `sendFile`; also handle the `sendFile` callback — `ENOENT` between stat and open must map to 404, not 500.
- `Content-Disposition` for download: `attachment; filename*=UTF-8''<encodeURIComponent(name)>` (RFC 5987) so Cyrillic filenames survive.

```ts
@Get(':meetingId/files/:fileId/preview')
async preview(@Param() p, @UserId() userId, @Res() res, @Next() next) {
  const rec = await this.service.findOwned(p.fileId, p.meetingId, userId);
  if (!rec) throw new NotFoundException('File not found');
  res.sendFile(join(UPLOAD_DIR, userId, p.meetingId, rec.storageName),
    { acceptRanges: true, dotfiles: 'deny' },
    (err) => next(err?.code === 'ENOENT' ? new NotFoundException('File not found') : err));
}

@Get(':meetingId/files/:fileId/download')
download(@Param() p, @UserId() userId) {
  const rec = await this.service.findOwned(p.fileId, p.meetingId, userId);
  return new StreamableFile(createReadStream(join(UPLOAD_DIR, userId, p.meetingId, rec.storageName)), {
    type: rec.mimeType,
    disposition: `attachment; filename*=UTF-8''${encodeURIComponent(rec.originalName)}`,
  });
}
```

Sources:
- https://docs.nestjs.com/techniques/streaming-files
- https://github.com/nestjs/nest/blob/master/packages/common/file-stream/streamable-file.js
- https://expressjs.com/en/4x/api.html#res.sendFile
- https://github.com/expressjs/send

### 3.4 Filename sanitization (FR-14, NFR-4)

- **Stored name never derives from user input:** `randomUUID() + whitelisted extension`. Original name kept only as display metadata.
- Sanitize the *display* name: `path.basename()` (strips `../../`), strip control chars `\u0000-\u001f\u007f`, truncate ~120 chars (plan: >255), reject empty.
- Extension comes from the **detected MIME**, not `originalname`.
- On every read/delete: `resolve()` the target and assert it stays under the upload root; validate `meetingId` with `ParseUUIDPipe`.
- multer 2.1.0+ fixed Cyrillic `originalname` mangling (`defParamCharset`, default `utf8`) — a product-relevant reason for the D7 override.

```ts
const sanitizeOriginalName = (name: string) =>
  path.basename(String(name ?? ''))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 120);

// read guard
const abs = resolve(join(UPLOAD_DIR, userId, meetingId), rec.storageName);
if (!abs.startsWith(join(UPLOAD_DIR, userId, meetingId) + sep))
  throw new ForbiddenException();
```

Sources:
- https://owasp.org/www-community/File_Upload_Cheat_Sheet
- https://nodejs.org/api/path.html#pathbasenamepath-suffix
- https://github.com/expressjs/multer/pull/1299

### 3.5 MIME validation via magic bytes (FR-3, risk in plan §5)

- `file.mimetype` is a client-set header — pre-filter only. Authoritative check = magic bytes with the **`file-type`** package, then compare against the allowlist (`audio/*`, `video/*`, pdf, doc, docx, pptx…).
- Serve with `X-Content-Type-Options: nosniff`; never serve user content as HTML/JS.
- **ESM caveat (verified):** `file-type@20.4.1` is pure ESM (`"type": "module"`). The API build is CommonJS:
  - Runtime: `await eval('import("file-type")')` works in Node CJS, but Nest's built-in `FileTypeValidator` requires `file.buffer` (MemoryStorage) and silently returns `false` on import failure.
  - e2e: under ts-jest CJS **without** `--experimental-vm-modules`, the dynamic ESM import fails in the Jest sandbox → every magic-byte check fails.
- **Resolution:** do magic-byte detection in the service (read first ~4100 bytes from the disk-stored file) behind an injected interface, so tests can stub it. This is the only clean way to keep disk storage + e2e CJS.

```ts
// injected, default impl:
export const detectMime = async (abs: string): Promise<string | null> => {
  const { fileTypeFromBuffer } = await import('file-type'); // only place file-type loads
  const fh = await open(abs, 'r');
  const head = Buffer.alloc(4100);
  const { bytesRead } = await fh.read(head, 0, 4100, 0);
  await fh.close();
  return (await fileTypeFromBuffer(head.subarray(0, bytesRead)))?.mime ?? null;
};

// in upload flow, after multer wrote the file:
const detected = await this.detectMime(abs);
if (!detected || !ALLOWED_MIME.has(detected)) {
  await unlink(abs).catch(() => undefined);
  throw new BadRequestException('File content does not match allowed types');
}
```

Sources:
- https://github.com/sindresorhus/file-type
- https://docs.nestjs.com/techniques/file-upload#validators
- https://owasp.org/www-community/controls/Unrestricted_File_Upload
- https://nodejs.org/api/esm.html

### 3.6 Directory structure, delete flow, orphan cleanup (FR-4, FR-9)

- Layout `UPLOAD_DIR/{userId}/{meetingId}/{storageName}`. Storage root **outside webroot**, served only via the stream endpoints. Provenance + per-user scoping + easy sweeper.
- Verify meeting ownership **before** writing — cleanest via a route guard (runs before the interceptor) or inside the `destination` callback.
- **Delete flow (deviates from plan D4):** delete DB row first, then `unlink` in try/catch (log on failure; sweeper finishes). Never present a read where "DB says exists but file is gone".
- **Orphan cleanup (two layers):**
  1. Immediate: `unlink` the just-written file on magic-byte rejection.
  2. Scheduled sweeper (`@nestjs/schedule` `@Cron`, e.g. daily 3 AM): walk `UPLOAD_DIR`, remove files with no `storageName` row in DB (and rows whose file is missing), age threshold ~24h to avoid racing in-flight uploads. Needed because a crash between disk write and DB commit leaves orphans.

```ts
// delete
const rec = await prisma.meetingFile.findFirst({ where: { id, meetingId, userId } });
if (!rec) throw new NotFoundException('File not found');
await prisma.meetingFile.delete({ where: { id } });
try { await unlink(join(UPLOAD_DIR, userId, meetingId, rec.storageName)); }
catch (e) { this.logger.warn(`Orphaned ${rec.storageName}: ${e.message}`); }

// sweeper (apps/api/src/files/orphan-sweeper.service.ts)
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async sweep() {
  for (const p of walk(UPLOAD_DIR)) {
    if ((await stat(p)).mtimeMs > Date.now() - 24h) continue;
    if (!(await prisma.meetingFile.findUnique({ where: { storageName: basename(p) } })))
      await unlink(p).catch(() => undefined);
  }
}
```

Sources:
- https://docs.nestjs.com/techniques/scheduling
- https://github.com/expressjs/multer/security/advisories/GHSA-3p4h-7m6x-2hcm
- https://docs.nestjs.com/faq/request-lifecycle

### 3.7 Prisma model (PF1, plan §9 + open question)

```prisma
model MeetingFile {
  id           String   @id @default(uuid(7))
  storageName  String   @unique
  originalName String
  mimeType     String
  size         Int
  createdAt    DateTime @default(now())
  meetingId    String
  userId       String
  meeting      Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@index([userId, meetingId])
  @@index([meetingId])
}

// in Meeting: files MeetingFile[]
```

- **Name it `MeetingFile`** (D5): avoids shadowing Node/DOM `File`, unambiguous in imports.
- `storageName @unique` — O(1) sweeper lookups; the only disk↔DB join key.
- **`onDelete: Cascade` is required** — Prisma's default for required relations is `Restrict`, so without it you cannot delete a meeting that has files. Cascade the rows; the sweeper clears disk.
- `uuid(7)` (time-ordered) if "recent files" list queries matter — avoids a separate index on `createdAt`. Prisma 7 supports both `uuid()` and `uuid(7)`.
- A single `findFirst({ where: { id, meetingId, userId } })` covers authz → the composite `@@index([userId, meetingId])` covers ownership lookups; `@@index([meetingId])` covers the list query.
- Optional: `uploadState` enum (PENDING/READY/FAILED) so the sweeper only touches non-READY rows.

Sources:
- https://www.prisma.io/docs/orm/prisma-schema/data-model/relations
- https://www.prisma.io/docs/orm/reference/prisma-schema-reference
- https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes

### 3.8 e2e testing (plan T1/T2 tests)

- Supertest `.attach()` for multipart; `.expect(206)` to verify Range streaming.
- Override `MULTER_MODULE_OPTIONS` (token `'MULTER_MODULE_OPTIONS'`, verified in `files.constants.js`) with a tiny `diskStorage` in a `mkdtempSync` dir + small `fileSize` limit → no real upload dir, no 100 MB files in tests.
- Cleanup: `afterAll` → `app.close()` + `rmSync(tmpDir, { recursive: true, force: true })` + `prisma.meetingFile.deleteMany()`.
- **Adjust plan expectations:** oversize → **413** (not 400, D1). Bad MIME → 400 (from `fileFilter`/magic bytes). Ownership violations on meeting/file → **404** (consistent with existing `meetings.e2e-spec.ts`, not 403 — the plan's PRD §12 mentions 403, but the repo convention and plan §2 both use 404).
- Auth: reuse the JWT flow from `auth.e2e-spec.ts`; `@UserId()` honors the `x-user-id` header fallback (verified) — handy for negative authz tests.

```ts
const tmpDir = mkdtempSync(join(tmpdir(), 'uploads-'));
beforeAll(async () => {
  const ref = await Test.createTestingModule({ imports: [FilesModule] })
    .overrideProvider(MULTER_MODULE_OPTIONS)
    .useValue({
      storage: diskStorage({
        destination: tmpDir,
        filename: (_, f, cb) => cb(null, `${randomUUID()}${extname(f.originalname)}`),
      }),
      limits: { fileSize: 1024 * 1024 },
    })
    .compile();
  app = ref.createNestApplication();
  await app.init();
});

it('uploads then streams with Range', async () => {
  const up = await request(app.getHttpServer())
    .post(`/meetings/${meetingId}/files`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.from('fake-mp4-bytes'), 'clip.mp4')
    .expect(201);
  await request(app.getHttpServer())
    .get(`/meetings/${meetingId}/files/${up.body.id}/preview`)
    .set('Range', 'bytes=0-3')
    .expect(206);
});
```

Sources:
- https://docs.nestjs.com/fundamentals/testing
- https://github.com/nestjs/nest/blob/master/packages/platform-express/multer/files.constants.js
- https://jestjs.io/docs/ecmascript-modules

---

## 4. Frontend Research

### 4.1 Upload progress: XHR wrapper (FR-10, US-6)

- `fetch` has **no upload-progress events** — only XHR exposes them via `XMLHttpRequest.upload`. axios's `onUploadProgress` works only because its default browser adapter is XHR; the experimental fetch adapter drops it. Project has no axios → **don't add it for one feature**.
- Use a small (~30-line) XHR wrapper for the upload call; keep the existing `fetch`-based client for everything else. Note: the plan's open question §6 "Decision made: use XHR" is confirmed correct.

```ts
// apps/web/src/lib/upload-with-progress.ts
export function uploadWithProgress({
  url, file, token, onProgress, signal,
}: {
  url: string; file: File; token: string;
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.responseType = 'json';

    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(new Response(JSON.stringify(xhr.response), { status: xhr.status }))
        : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error'));
    signal?.addEventListener('abort', () => xhr.abort());

    const body = new FormData();
    body.append('file', file);
    xhr.send(body);
  });
}
```

Sources:
- https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload
- https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/progress_event
- https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
- https://axios-http.com/docs/req_config

### 4.2 HeroUI v3: `ProgressBar`, not `Progress` (plan T4/T6)

- HeroUI v3 exports **`ProgressBar`** (verified in `node_modules/@heroui/react`); there is no `Progress`. It's built on React Aria (`role="progressbar"`), with `size`/`color` variants, an `Output` slot for the percentage text, and `isIndeterminate`.
- **ARIA contract (WAI-ARIA 1.2):** `aria-valuemin/max` default 0/100; `aria-valuenow` must be present for determinate progress and **omitted when indeterminate**; an accessible name is required (`aria-label` or `<Label>`).
- Use indeterminate while the server processes after the transfer completes (percent stuck at 100).

```tsx
'use client';
import { Label, ProgressBar } from '@heroui/react';

<ProgressBar aria-label="Загрузка файла" className="w-64" value={percent}
  formatOptions={{ locale: 'ru-RU', style: 'percent' }}>
  <Label>Загрузка…</Label>
  <ProgressBar.Output />
  <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>

{/* indeterminate during server processing */}
<ProgressBar aria-label="Обработка файла" isIndeterminate className="w-64">
  <Label>Обработка…</Label>
  <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
```

Sources:
- https://www.w3.org/TR/wai-aria-1.2/#progressbar
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress
- https://heroui.com/docs/react/components/progress-bar
- Installed types: `node_modules/@heroui/react/dist/components/progress-bar/`

### 4.3 Dropzone & file selection accessibility (FR-1, NFR-5, NFR-8)

- HeroUI v3 has **no DropZone** (verified). Two solid options, both already in the dependency tree:
  1. **React Aria Components `DropZone` + `FileTrigger`** (transitive dep of `@heroui/react`) — full keyboard + drag/drop accessibility, `data-drop-target` states, `onSelect(FileList)`.
  2. **Native `<input type="file">`** (visually hidden) + styled HeroUI `Button`/`Label` — simplest, native keyboard support.
- Either way: drop region must be focusable and operable via Space/Enter; accessible name required; `accept` + `multiple` filter the picker. Note `useDropZone` hook does not exist — RAC `DropZone` is built over `useDrop`.

```tsx
'use client';
import { FileTrigger, DropZone } from 'react-aria-components';
import { Button } from '@heroui/react';

<FileTrigger accept={['audio/*', 'video/*', 'application/pdf', 'application/msword']}
  onSelect={(files) => files && handleFiles([...files])}>
  <Button aria-label="Выбрать файлы для загрузки">Выбрать файлы</Button>
</FileTrigger>

<DropZone onDrop={(e) => {
  const files = await Promise.all(e.items
    .filter(i => i.kind === 'file')
    .map(i => i.getFile()));
  handleFiles(files);
}}>
  <div data-drop-target>Перетащите файлы сюда</div>
</DropZone>
```

Sources:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file
- https://react-spectrum.adobe.com/react-aria/DropZone.html
- https://react-spectrum.adobe.com/react-aria/FileTrigger.html

### 4.4 File size formatting (FR-13, US-7)

- Write a ~15-line pure function; **no npm dependency** (`filesize`/`bytes` are unnecessary).
- Use binary units (base 1024: Б, КБ, МБ, ГБ) — matches OS/file-manager conventions — and let `Intl.NumberFormat` handle the locale-aware number (`ru-RU` → `1,5 МБ`).

```ts
// apps/web/src/lib/format-file-size.ts
const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;

export function formatFileSize(bytes: number, locale = 'ru-RU'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes === 0) return '0 Б';
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 1024 ** i;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(value);
  return `${formatted} ${UNITS[i]}`;
}
```

Sources:
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat

### 4.5 Client-side pre-validation (plan T4)

- Per OWASP: client-side validation is **UX only, never a security control**. Do it for instant feedback (inline next to the dropzone — NFR-8), but the API must re-validate size, MIME, and magic bytes server-side.
- `File.type` is advisory/spoofable; `accept` is a picker filter, not an enforcement gate. Validate on selection: allowed type + `file.size` ≤ 100 MB.

```ts
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = /^(audio\/|video\/|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.)/;

function validateFile(f: File): string | null {
  if (!ALLOWED.test(f.type)) return `Недопустимый тип файла: ${f.name}`;
  if (f.size > MAX_BYTES) return `Файл слишком большой: ${formatFileSize(f.size)} (макс. 100 МБ)`;
  if (f.size === 0) return 'Пустой файл';
  return null;
}
```

Sources:
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file

### 4.6 Download & preview with JWT auth (FR-8/FR-11, US-3/US-5)

Auth is JWT in `localStorage` → sent via `Authorization` header. A plain `<a href>` / `<video src>` can't set headers. Two viable strategies:

1. **Blob URL** (recommended for this MVP): `fetch(url, { headers: { Authorization } })` → `response.blob()` → `URL.createObjectURL(blob)` → use as `<video src>` or trigger `a[download]`. Browsers support Range/seeking against blob URLs, so the scrubber works. **Cost: the whole file is in memory** (up to 100 MB per preview). Always `URL.revokeObjectURL()` on unmount — mandatory, leaks otherwise.
2. **Signed streaming URL** (future / large files): short-lived (1–5 min TTL) capability token in the URL so `<video src>` streams with native Range. Never put the JWT itself in a URL (leaks to history/proxy logs). This is the plan's NFR path when files outgrow blob memory limits.

For MVP: blob URL for both download (click → fetch → anchor) and preview. `a[download]` works on blob URLs (same-origin). Known limitation: 100 MB in memory per concurrent preview — acceptable now, revisit with S3 (NG4).

```tsx
async function downloadFile(id: string, filename: string, token: string) {
  const res = await fetch(`/meetings/${id}/files/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

Sources:
- https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
- https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests

### 4.7 Confirm-delete dialog (FR-9, plan T5)

- Use HeroUI v3 **`AlertDialog`** — purpose-built for destructive confirmations (`role="alertdialog"`). Its defaults encode APG semantics: `isDismissable=false` (backdrop click won't close), `isKeyboardDismissDisabled=true` (ESC won't close). Focus trap + scroll lock + ARIA wiring for free.
- **Avoid `window.confirm()`** — blocking modal prompts are discouraged by MDN and can be suppressed by browsers.
- Render confirm as `variant="danger"`, cancel as `variant="tertiary"`, both `slot="close"`. For async delete, drive open state with `useState` and show a spinner on the confirm button.

```tsx
import { AlertDialog, Button } from '@heroui/react';

<AlertDialog isOpen={open} onOpenChange={setOpen}>
  <Button variant="danger">Удалить файл</Button>
  <AlertDialog.Backdrop>
    <AlertDialog.Container>
      <AlertDialog.Dialog className="sm:max-w-[400px]">
        <AlertDialog.Header>
          <AlertDialog.Icon status="danger" />
          <AlertDialog.Heading>Удалить «{name}»?</AlertDialog.Heading>
        </AlertDialog.Header>
        <AlertDialog.Body>
          <p>Действие необратимо — файл будет удалён навсегда.</p>
        </AlertDialog.Body>
        <AlertDialog.Footer>
          <Button slot="close" variant="tertiary">Отмена</Button>
          <Button slot="close" variant="danger" onPress={onConfirm}>Удалить</Button>
        </AlertDialog.Footer>
      </AlertDialog.Dialog>
    </AlertDialog.Container>
  </AlertDialog.Backdrop>
</AlertDialog>
```

Sources:
- https://heroui.com/docs/react/components/alert-dialog
- https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm

---

## 5. Recommendations Map → Plan Tickets

| Ticket | Recommended approach | Key sources |
|--------|----------------------|-------------|
| PF1 | `MeetingFile` model (D5), `uuid(7)`, `storageName @unique`, `onDelete: Cascade`, composite indexes | §3.7 |
| PF2 | `uploads/` dir, gitignore, `nest-cli.json` assets (keep). Root outside webroot. | §3.6 |
| T1 | Disk storage + `multerDiskOptions`, `ParseUUIDPipe`, ownership guard, magic bytes via injected detector, 413 for oversize (D1), global `AllExceptionsFilter` for 507 | §3.1–3.5 |
| T2 | Download via `StreamableFile`; preview via `res.sendFile({ acceptRanges })` (D3); DB-first delete (D4) | §3.3, §3.6 |
| T3 | Keep as planned: fetch meeting, render info + Files placeholder; `<Spinner>` / `role="alert"` / 404 states | — |
| T4 | React Aria `FileTrigger`/`DropZone`, XHR wrapper, `ProgressBar`, inline client validation | §4.1–4.3, §4.5 |
| T5 | `FileList`/`FileItem` with skeleton, empty, error states; blob-URL download; `AlertDialog` delete | §4.6, §4.7 |
| T6 | `ProgressBar` polish, `formatFileSize` (no deps), inline SVG icons, `<figure>`+`<figcaption>` around players | §4.2, §4.4 |

---

## 6. Open Questions / Decisions Needed

1. **e2e ESM strategy (D6):** add `--experimental-vm-modules` to `test:e2e`, or inject the magic-byte detector and stub it in tests? Recommended: inject (keeps runner unchanged, still covers the default path).
2. **Sweeper:** `@nestjs/schedule` adds a new runtime dep + job. Alternative: defer the cron sweeper to a follow-up and rely on immediate `unlink` on rejection + DB-first delete. Recommended: include the sweeper — a crash between disk write and DB commit is a real orphan source.
3. **Preview memory limit:** blob-URL preview holds up to 100 MB in the browser. Acceptable for MVP; signed streaming URL is the documented upgrade path (NG4/S3).
4. **`uuid(7)` vs `uuid()`:** pick `uuid(7)` for sortable ids (no extra `createdAt` index); revisit if any client assumes lexicographic order.
5. **Ownership status code:** repo + plan convention is **404** for other-user resources (matches `meetings.e2e-spec.ts`). PRD §12 mentions 403 — decide 404 (recommended, consistent) and update PRD wording.

---

## 7. Source Index

**NestJS / backend**
- https://docs.nestjs.com/techniques/file-upload
- https://docs.nestjs.com/techniques/streaming-files
- https://docs.nestjs.com/techniques/scheduling
- https://docs.nestjs.com/exception-filters
- https://docs.nestjs.com/faq/request-lifecycle
- https://github.com/expressjs/multer
- https://github.com/sindresorhus/file-type
- https://www.prisma.io/docs/orm/prisma-schema/data-model/relations

**Security / standards**
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- https://owasp.org/www-community/File_Upload_Cheat_Sheet
- https://www.w3.org/TR/wai-aria-1.2/#progressbar
- https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

**Frontend**
- https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload
- https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests
- https://heroui.com/docs/react/components/progress-bar
- https://heroui.com/docs/react/components/alert-dialog
- https://react-spectrum.adobe.com/react-aria/DropZone.html
- https://react-spectrum.adobe.com/react-aria/FileTrigger.html
