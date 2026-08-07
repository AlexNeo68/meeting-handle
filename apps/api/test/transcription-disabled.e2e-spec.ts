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

describe('Transcription disabled (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tmpDir: string;
  let token: string;
  let meetingId: string;

  const detectorMock = {
    detect: jest.fn().mockResolvedValue('audio/mpeg'),
  };

  const engineMock = {
    transcribe: jest.fn().mockResolvedValue({ transcript: 'Hello transcription', language: 'en' }),
  };

  beforeAll(async () => {
    process.env.TRANSCRIPTION_ENABLED = 'false';
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
      .send({ email: 'disabled@example.com', password: 'password123' });
    token = userRes.body.token;

    const meetingRes = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Disabled Meeting',
        date: '2026-08-01T10:00:00Z',
        participants: ['Alice'],
      });
    meetingId = meetingRes.body.id;
  });

  afterAll(async () => {
    delete process.env.TRANSCRIPTION_ENABLED;
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

  it('uploads a transcribable file without PENDING status and without calling the engine', async () => {
    const res = await uploadMp3().expect(201);

    expect(res.body.transcriptionStatus).toBeNull();
    expect(engineMock.transcribe).not.toHaveBeenCalled();
  });

  it('returns 409 Transcription disabled on GET transcript', async () => {
    const uploadRes = await uploadMp3().expect(201);

    const res = await request(app.getHttpServer())
      .get(`/meetings/${meetingId}/files/${uploadRes.body.id}/transcript`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(res.body.message).toBe('Transcription disabled');
  });

  it('returns 409 Transcription disabled on POST retry', async () => {
    const uploadRes = await uploadMp3().expect(201);

    const res = await request(app.getHttpServer())
      .post(`/meetings/${meetingId}/files/${uploadRes.body.id}/transcription/retry`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(res.body.message).toBe('Transcription disabled');
  });
});
