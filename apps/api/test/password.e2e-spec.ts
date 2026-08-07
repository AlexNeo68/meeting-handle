import './test-env';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerStorage } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WHISPER_ENGINE } from '../src/transcription/transcription.constants';

const engineStub = { transcribe: jest.fn(), warmup: jest.fn().mockResolvedValue(undefined) };

describe('Password change (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storage: { storage: Map<string, unknown> };
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WHISPER_ENGINE)
      .useValue(engineStub)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(ThrottlerStorage);
  });

  beforeEach(async () => {
    storage.storage.clear();

    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    const userRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'password@example.com', password: 'password123' });
    token = userRes.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  const patchPassword = (password: string, bearer = token) =>
    request(app.getHttpServer())
      .patch('/user/password')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ password });

  const loginAs = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.token as string;
  };

  // Every successful password change bumps tokenVersion, invalidating previous
  // JWTs, so each attempt needs a fresh token from the current password.
  const exhaustLimit = async (email: string, initialPassword: string) => {
    let currentPassword = initialPassword;
    for (let i = 0; i < 5; i++) {
      const freshToken = await loginAs(email, currentPassword);
      const nextPassword = `newpassword${i}`;
      await patchPassword(nextPassword, freshToken).expect(200);
      currentPassword = nextPassword;
    }
    return currentPassword;
  };

  describe('PATCH /user/password', () => {
    it('should change the password and return 200', async () => {
      const res = await patchPassword('newpassword123').expect(200);

      expect(res.body).toEqual({ message: 'Password updated' });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'password@example.com', password: 'newpassword123' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'password@example.com', password: 'password123' })
        .expect(401);
    });

    it('should return 400 for a short password', async () => {
      await patchPassword('12345').expect(400);
    });

    it('should return 400 when the new password matches the current one', async () => {
      await patchPassword('password123').expect(400);
    });

    it('should return 401 without auth', async () => {
      await patchPassword('newpassword123', '').expect(401);
    });

    it('should ignore the x-user-id header and act on the authenticated user', async () => {
      const victimRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'victim@example.com', password: 'victimpass123' });

      await request(app.getHttpServer())
        .patch('/user/password')
        .set('Authorization', `Bearer ${token}`)
        .set('x-user-id', victimRes.body.userId)
        .send({ password: 'attackernewpass123' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'password@example.com', password: 'attackernewpass123' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'victim@example.com', password: 'victimpass123' })
        .expect(200);
    });

    it('should return 429 after exceeding the request limit', async () => {
      const currentPassword = await exhaustLimit('password@example.com', 'password123');

      const freshToken = await loginAs('password@example.com', currentPassword);
      await patchPassword('newpassword5', freshToken).expect(429);

      expect(freshToken).toBeDefined();
    });

    it('should not block a different user behind the same IP', async () => {
      await exhaustLimit('password@example.com', 'password123');

      const siblingRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'sibling@example.com', password: 'siblingpass123' });

      const siblingToken = siblingRes.body.token as string;

      await request(app.getHttpServer())
        .patch('/user/password')
        .set('Authorization', `Bearer ${siblingToken}`)
        .send({ password: 'siblingnewpass123' })
        .expect(200);
    });

    it('should not block the same user behind a different IP', async () => {
      let currentPassword = 'password123';
      for (let i = 0; i < 5; i++) {
        const freshToken = await loginAs('password@example.com', currentPassword);
        const nextPassword = `newpassword${i}`;
        await request(app.getHttpServer())
          .patch('/user/password')
          .set('Authorization', `Bearer ${freshToken}`)
          .set('X-Forwarded-For', '10.0.0.1')
          .send({ password: nextPassword })
          .expect(200);
        currentPassword = nextPassword;
      }

      const blockedToken = await loginAs('password@example.com', currentPassword);
      await request(app.getHttpServer())
        .patch('/user/password')
        .set('Authorization', `Bearer ${blockedToken}`)
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ password: 'newpassword5' })
        .expect(429);

      const otherIpToken = await loginAs('password@example.com', currentPassword);
      await request(app.getHttpServer())
        .patch('/user/password')
        .set('Authorization', `Bearer ${otherIpToken}`)
        .set('X-Forwarded-For', '10.0.0.2')
        .send({ password: 'newpassword6' })
        .expect(200);
    });
  });
});

describe('Password change — rate limit with trust proxy disabled (default)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storage: { storage: Map<string, unknown> };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WHISPER_ENGINE)
      .useValue(engineStub)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(ThrottlerStorage);
  });

  beforeEach(async () => {
    storage.storage.clear();

    await prisma.meetingFile.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'noproxy@example.com', password: 'password123' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should NOT trust the X-Forwarded-For header when trust proxy is off, so spoofed IPs cannot bypass the limit', async () => {
    let currentPassword = 'password123';
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noproxy@example.com', password: currentPassword })
        .expect(200);
      const nextPassword = `newpassword${i}`;
      await request(app.getHttpServer())
        .patch('/user/password')
        .set('Authorization', `Bearer ${res.body.token}`)
        .set('X-Forwarded-For', `203.0.113.${i}`)
        .send({ password: nextPassword })
        .expect(200);
      currentPassword = nextPassword;
    }

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'noproxy@example.com', password: currentPassword })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/user/password')
      .set('Authorization', `Bearer ${res.body.token}`)
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ password: 'newpassword99' })
      .expect(429);
  });
});
