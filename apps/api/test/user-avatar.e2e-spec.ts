import 'dotenv/config';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MULTER_MODULE_OPTIONS } from '@nestjs/platform-express/multer/files.constants';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MIME_TYPE_DETECTOR, UPLOAD_DIR } from '../src/files/files.constants';
import { avatarDiskOptions } from '../src/user/avatar.options';

describe('User Avatar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tmpDir: string;
  let token: string;

  const detectorMock = {
    detect: jest.fn().mockResolvedValue('image/jpeg'),
  };

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'avatars-'));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MULTER_MODULE_OPTIONS)
      .useValue(avatarDiskOptions(tmpDir))
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
    detectorMock.detect.mockResolvedValue('image/jpeg');

    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'avatar@example.com', password: 'password123' });
    token = userRes.body.token;
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const upload = (buffer: Buffer, filename: string, contentType: string) =>
    request(app.getHttpServer())
      .post('/user/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, { filename, contentType });

  describe('POST /user/profile/avatar', () => {
    it('should upload a valid image and return profile with hasAvatar true', async () => {
      const res = await upload(Buffer.from('fake-jpeg-bytes'), 'photo.jpg', 'image/jpeg').expect(
        201,
      );

      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'avatar@example.com',
        name: null,
        hasAvatar: true,
      });
    });

    it('should accept png and webp uploads', async () => {
      await upload(Buffer.from('fake-png-bytes'), 'photo.png', 'image/png').expect(201);

      const webp = await upload(Buffer.from('fake-webp-bytes'), 'photo.webp', 'image/webp').expect(
        201,
      );

      expect(webp.body.hasAvatar).toBe(true);
    });

    it('should return 400 with an English 5 MB size-limit key for a file over the size limit', async () => {
      const res = await upload(Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png', 'image/png').expect(
        400,
      );

      expect(res.body.message).toBe('File size exceeds 5 MB limit');
    });

    it('should return 400 for an unsupported MIME type', async () => {
      await upload(Buffer.from('MZ...'), 'malware.exe', 'application/x-msdownload').expect(400);
    });

    it('should return 400 when a spoofed image Content-Type wraps non-image content', async () => {
      detectorMock.detect.mockResolvedValue('application/pdf');

      await upload(Buffer.from('%PDF-1.4 not-an-image'), 'photo.png', 'image/png').expect(400);
    });

    it('should return 400 when the real content type cannot be detected', async () => {
      detectorMock.detect.mockResolvedValue(null);

      await upload(Buffer.from('not-an-image'), 'photo.png', 'image/png').expect(400);
    });

    it('should return 400 when no file is provided', async () => {
      await request(app.getHttpServer())
        .post('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/user/profile/avatar')
        .attach('file', Buffer.from('x'), { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(401);
    });
  });

  describe('GET /user/profile/avatar', () => {
    it('should stream the uploaded avatar with detected content type', async () => {
      await upload(Buffer.from('fake-jpeg-bytes'), 'photo.jpg', 'image/jpeg').expect(201);

      const res = await request(app.getHttpServer())
        .get('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('image/jpeg');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect((res.body as Buffer).toString('utf8')).toBe('fake-jpeg-bytes');
    });

    it('should return 404 when the user has no avatar', async () => {
      await request(app.getHttpServer())
        .get('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 when the avatar file is missing on disk', async () => {
      const user = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { avatarStoragePath: `missing/${crypto.randomUUID()}.png` },
      });

      await request(app.getHttpServer())
        .get('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).get('/user/profile/avatar').expect(401);
    });
  });

  describe('DELETE /user/profile/avatar', () => {
    it('should delete the avatar: file gone from disk, avatarStoragePath cleared', async () => {
      await upload(Buffer.from('fake-jpeg-bytes'), 'photo.jpg', 'image/jpeg').expect(201);

      const before = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      const avatarPath = join(tmpDir, before!.avatarStoragePath!);
      expect(existsSync(avatarPath)).toBe(true);

      const res = await request(app.getHttpServer())
        .delete('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'Avatar deleted' });
      expect(existsSync(avatarPath)).toBe(false);

      const after = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      expect(after!.avatarStoragePath).toBeNull();
    });

    it('should return 404 for GET avatar after delete', async () => {
      await upload(Buffer.from('fake-jpeg-bytes'), 'photo.jpg', 'image/jpeg').expect(201);

      await request(app.getHttpServer())
        .delete('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should tolerate deleting when the avatar file is missing on disk', async () => {
      await upload(Buffer.from('fake-jpeg-bytes'), 'photo.jpg', 'image/jpeg').expect(201);
      const user = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      await prisma.user.update({
        where: { id: user!.id },
        data: { avatarStoragePath: `missing/${crypto.randomUUID()}.png` },
      });

      const res = await request(app.getHttpServer())
        .delete('/user/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'Avatar deleted' });
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).delete('/user/profile/avatar').expect(401);
    });
  });

  describe('replace', () => {
    it('should delete the old avatar file when replacing', async () => {
      await upload(Buffer.from('first-avatar'), 'first.png', 'image/png').expect(201);

      const before = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      const oldPath = join(tmpDir, before!.avatarStoragePath!);
      expect(existsSync(oldPath)).toBe(true);

      await upload(Buffer.from('second-avatar'), 'second.png', 'image/png').expect(201);

      const after = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      expect(after!.avatarStoragePath).not.toBe(before!.avatarStoragePath);
      expect(existsSync(oldPath)).toBe(false);
      expect(existsSync(join(tmpDir, after!.avatarStoragePath!))).toBe(true);
    });

    it('should still work when the old avatar is already missing on disk', async () => {
      await upload(Buffer.from('first-avatar'), 'first.png', 'image/png').expect(201);
      const before = await prisma.user.findUnique({ where: { email: 'avatar@example.com' } });
      await prisma.user.update({
        where: { id: before!.id },
        data: { avatarStoragePath: 'missing/ghost.png' },
      });

      const res = await upload(Buffer.from('second-avatar'), 'second.png', 'image/png').expect(201);

      expect(res.body.hasAvatar).toBe(true);
    });
  });
});
