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
import { WHISPER_ENGINE } from '../src/transcription/transcription.constants';
import { TranscriptionStatus } from '../generated/prisma/enums';

describe('Transcription (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tmpDir: string;
  let token: string;
  let ownerUserId: string;
  let meetingId: string;

  const detectorMock = {
    detect: jest.fn().mockResolvedValue('audio/mpeg'),
  };

  const engineMock = {
    transcribe: jest.fn().mockResolvedValue({ transcript: 'Hello transcription', language: 'en' }),
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
      .overrideProvider(WHISPER_ENGINE)
      .useValue(engineMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    detectorMock.detect.mockReset();
    detectorMock.detect.mockResolvedValue('audio/mpeg');
    engineMock.transcribe.mockClear();

    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'transcription@example.com', password: 'password123' });
    token = userRes.body.token;
    ownerUserId = userRes.body.userId;

    const meetingRes = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Transcription Meeting',
        date: '2026-08-01T10:00:00Z',
        participants: ['Alice'],
      });
    meetingId = meetingRes.body.id;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const uploadMp3 = () =>
    request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-mp3-content'), {
        filename: 'audio.mp3',
        contentType: 'audio/mpeg',
      });

  const waitForStatus = async (fileId: string, status: string, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const file = res.body.files.find((f: { id: string }) => f.id === fileId);
      if (file?.transcriptionStatus === status) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for file ${fileId} to reach status ${status}`);
  };

  const createRecord = (status: TranscriptionStatus) =>
    prisma.meetingFile.create({
      data: {
        storagePath: `missing/${crypto.randomUUID()}.mp3`,
        originalName: 'record.mp3',
        mimeType: 'audio/mpeg',
        size: 10,
        meetingId,
        userId: ownerUserId,
        transcriptionStatus: status,
      },
    });

  describe('GET /meetings/:meetingId/files/:fileId/transcript', () => {
    it('should return the transcript once the background transcription completes', async () => {
      const uploadRes = await uploadMp3().expect(201);

      expect(uploadRes.body.transcriptionStatus).toBe('PENDING');
      expect(uploadRes.body.transcriptionProgress).toBeDefined();

      await waitForStatus(uploadRes.body.id, 'COMPLETED');

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${uploadRes.body.id}/transcript`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.transcript).toBe('Hello transcription');
      expect(res.body.language).toBe('en');
      expect(res.body.transcribedAt).toBeDefined();
    });

    it('should not transcribe a non-audio file', async () => {
      detectorMock.detect.mockResolvedValueOnce('application/pdf');

      const res = await uploadMp3().expect(201);

      expect(res.body.transcriptionStatus).toBeNull();
      expect(engineMock.transcribe).not.toHaveBeenCalled();
    });

    it('should return 409 when the transcription is not completed', async () => {
      const record = await createRecord('FAILED');

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${record.id}/transcript`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);

      expect(res.body.message).toBe('Transcription not completed');
    });

    it('should return 404 for another user file', async () => {
      const record = await createRecord('COMPLETED');

      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'transcript-other@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${record.id}/transcript`)
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .expect(404);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000/transcript`)
        .expect(401);
    });
  });

  describe('POST /meetings/:meetingId/files/:fileId/transcription/retry', () => {
    it('should retry a failed transcription and produce a transcript', async () => {
      const record = await createRecord('FAILED');

      const res = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files/${record.id}/transcription/retry`)
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      expect(res.body.transcriptionStatus).toBe('PENDING');

      await waitForStatus(record.id, 'COMPLETED');

      const transcriptRes = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${record.id}/transcript`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(transcriptRes.body.transcript).toBe('Hello transcription');
    });

    it('should return 400 when the transcription is already in progress', async () => {
      const record = await createRecord('PENDING');

      const res = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files/${record.id}/transcription/retry`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.message).toBe('Transcription already in progress');
    });

    it('should return 400 when the transcription is not available', async () => {
      const record = await createRecord('COMPLETED');

      const res = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files/${record.id}/transcription/retry`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.message).toBe('Transcription not available');
    });

    it('should return 404 for another user file', async () => {
      const record = await createRecord('FAILED');

      const otherRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'retry-other@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files/${record.id}/transcription/retry`)
        .set('Authorization', `Bearer ${otherRes.body.token}`)
        .expect(404);
    });
  });
});
