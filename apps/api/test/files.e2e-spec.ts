import './test-env';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MULTER_MODULE_OPTIONS } from '@nestjs/platform-express/multer/files.constants';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MIME_TYPE_DETECTOR, UPLOAD_DIR } from '../src/files/files.constants';
import { multerDiskOptions } from '../src/files/upload.options';

describe('Files (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tmpDir: string;
  let token: string;
  let ownerUserId: string;
  let meetingId: string;

  const detectorMock = {
    detect: jest.fn().mockResolvedValue('application/pdf'),
  };

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'uploads-'));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MULTER_MODULE_OPTIONS)
      .useValue({ ...multerDiskOptions(tmpDir), limits: { fileSize: 1024, files: 1 } })
      .overrideProvider(UPLOAD_DIR)
      .useValue(tmpDir)
      .overrideProvider(MIME_TYPE_DETECTOR)
      .useValue(detectorMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    detectorMock.detect.mockReset();
    detectorMock.detect.mockResolvedValue('application/pdf');

    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'files@example.com', password: 'password123' });
    token = userRes.body.token;
    ownerUserId = userRes.body.userId;

    const meetingRes = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Files Meeting', date: '2026-08-01T10:00:00Z', participants: ['Alice'] });
    meetingId = meetingRes.body.id;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const uploadPdf = () =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-pdf-content'), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      });

  describe('POST /meetings/:meetingId/files', () => {
    it('should upload a valid file and return 201 with metadata', async () => {
      const res = await uploadPdf().expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.originalName).toBe('notes.pdf');
      expect(res.body.mimeType).toBe('application/pdf');
      expect(res.body.size).toBeGreaterThan(0);
      expect(res.body.createdAt).toBeDefined();
    });

    it('should return 400 for file over the size limit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.alloc(2048), { filename: 'big.mp4', contentType: 'video/mp4' })
        .expect(400);

      expect(res.body.message).toBe('File size exceeds 100 MB limit');
    });

    it('should return 400 for an empty file', async () => {
      const res = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.alloc(0), { filename: 'empty.pdf', contentType: 'application/pdf' })
        .expect(400);

      expect(res.body.message).toBe('Empty file');
    });

    it('should return 400 for unsupported MIME type', async () => {
      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('MZ...'), {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);
    });

    it('should return 400 when file content is not an allowed type', async () => {
      detectorMock.detect.mockResolvedValueOnce(null);

      await uploadPdf().expect(400);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .attach('file', Buffer.from('fake'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(401);
    });

    it('should return 404 when uploading to another user meeting', async () => {
      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'other-user@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .attach('file', Buffer.from('fake'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });

    it('should return 404 when meeting does not exist', async () => {
      await request(app.getHttpServer())
        .post('/meetings/00000000-0000-0000-0000-000000000000/files')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });

    it('should sanitize a path-traversal filename on disk and keep the file downloadable', async () => {
      const res = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('fake-pdf-content'), {
          filename: '../../evil.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const record = await prisma.meetingFile.findUnique({ where: { id: res.body.id } });
      expect(record).not.toBeNull();
      expect(record!.storagePath).not.toContain('..');

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${res.body.id}/download`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should keep repeated uploads of the same filename as separate files', async () => {
      const first = await uploadPdf().expect(201);
      const second = await uploadPdf().expect(201);

      expect(first.body.id).not.toBe(second.body.id);

      const listRes = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listRes.body.files).toHaveLength(2);
    });
  });

  describe('GET /meetings/:meetingId/files', () => {
    it('should return 200 with the file list', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.files).toHaveLength(1);
      expect(res.body.files[0].id).toBe(uploadRes.body.id);
      expect(res.body.files[0].originalName).toBe('notes.pdf');
    });

    it('should return 200 with empty file list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ files: [] });
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).get(`/meetings/${meetingId}/files`).expect(401);
    });
  });

  describe('GET /meetings/:meetingId/files/:fileId/download', () => {
    it('should download an existing file as attachment', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${uploadRes.body.id}/download`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).toString('utf8')).toBe('fake-pdf-content');
    });

    it('should return 404 for a non-existent file', async () => {
      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000/download`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 when the file is missing on disk', async () => {
      const record = await prisma.meetingFile.create({
        data: {
          storagePath: `missing/${crypto.randomUUID()}.pdf`,
          originalName: 'ghost.pdf',
          mimeType: 'application/pdf',
          size: 10,
          meetingId,
          userId: ownerUserId,
        },
      });

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${record.id}/download`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 when the stored path escapes the upload dir (path traversal)', async () => {
      const record = await prisma.meetingFile.create({
        data: {
          storagePath: '../../../../etc/passwd',
          originalName: 'escape.pdf',
          mimeType: 'application/pdf',
          size: 10,
          meetingId,
          userId: ownerUserId,
        },
      });

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${record.id}/download`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 404 when downloading another user file', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'download-other@example.com', password: 'password123' });

      const otherMeetingRes = await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .send({ title: 'Other Meeting', date: '2026-08-01T10:00:00Z', participants: [] });

      await request(app.getHttpServer())
        .get(`/meetings/${otherMeetingRes.body.id}/files/${uploadRes.body.id}/download`)
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .expect(404);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000/download`)
        .expect(401);
    });
  });

  describe('GET /meetings/:meetingId/files/:fileId/preview', () => {
    it('should stream an existing file inline', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${uploadRes.body.id}/preview`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-disposition']).toContain('inline');
      expect((res.body as Buffer).toString('utf8')).toBe('fake-pdf-content');
    });

    it('should support Range requests with 206', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${uploadRes.body.id}/preview`)
        .set('Authorization', `Bearer ${token}`)
        .set('Range', 'bytes=0-3')
        .expect(206);

      expect(res.headers['accept-ranges']).toBe('bytes');
    });

    it('should return 404 for a non-existent file', async () => {
      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000/preview`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 when the file is missing on disk', async () => {
      const record = await prisma.meetingFile.create({
        data: {
          storagePath: `missing/${crypto.randomUUID()}.pdf`,
          originalName: 'ghost.pdf',
          mimeType: 'application/pdf',
          size: 10,
          meetingId,
          userId: ownerUserId,
        },
      });

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${record.id}/preview`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000/preview`)
        .expect(401);
    });
  });

  describe('DELETE /meetings/:meetingId/files/:fileId', () => {
    it('should delete an own file and return 200', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/${uploadRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'File deleted' });

      const listRes = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listRes.body.files).toEqual([]);
    });

    it('should return 404 for a non-existent file', async () => {
      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should delete a record whose file is already missing on disk', async () => {
      const record = await prisma.meetingFile.create({
        data: {
          storagePath: `missing/${crypto.randomUUID()}.pdf`,
          originalName: 'ghost.pdf',
          mimeType: 'application/pdf',
          size: 10,
          meetingId,
          userId: ownerUserId,
        },
      });

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/${record.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const remaining = await prisma.meetingFile.findUnique({ where: { id: record.id } });
      expect(remaining).toBeNull();
    });

    it('should return 404 when deleting another user file', async () => {
      const uploadRes = await uploadPdf().expect(201);

      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'delete-other@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/${uploadRes.body.id}`)
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .expect(404);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000`)
        .expect(401);
    });
  });
});
