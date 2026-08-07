import './test-env';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WHISPER_ENGINE } from '../src/transcription/transcription.constants';

describe('Meetings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const engineStub = { transcribe: jest.fn(), warmup: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WHISPER_ENGINE)
      .useValue(engineStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.meeting.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' });
    return { token: res.body.token as string, userId: res.body.userId as string };
  };

  const createMeeting = (
    token: string,
    title: string,
    date = '2026-08-01T10:00:00Z',
    participants: string[] = ['Alice'],
  ) =>
    request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, date, participants });

  describe('POST /meetings', () => {
    it('should create a meeting and return 201', async () => {
      const { token, userId } = await register('meeting-create@example.com');

      const res = await createMeeting(token, 'Sprint Planning').expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Sprint Planning');
      expect(res.body.date).toBeDefined();
      expect(res.body.participants).toEqual(['Alice']);
      expect(res.body.userId).toBe(userId);
    });

    it('should return 400 for missing title', async () => {
      const { token } = await register('missing-title@example.com');

      await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-08-01T10:00:00Z',
          participants: ['Alice'],
        })
        .expect(400);
    });

    it('should return 400 for invalid date', async () => {
      const { token } = await register('invalid-date@example.com');

      await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Bad Date',
          date: 'not-a-date',
          participants: ['Alice'],
        })
        .expect(400);
    });

    it('should return 400 when participants is not an array', async () => {
      const { token } = await register('bad-participants@example.com');

      await request(app.getHttpServer())
        .post('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test',
          date: '2026-08-01T10:00:00Z',
          participants: 'not-an-array',
        })
        .expect(400);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/meetings')
        .send({
          title: 'No Auth',
          date: '2026-08-01T10:00:00Z',
          participants: ['Alice'],
        })
        .expect(401);
    });
  });

  describe('GET /meetings', () => {
    it('should return all meetings for the user', async () => {
      const { token } = await register('meetings-list@example.com');

      await createMeeting(token, 'Meeting 1');
      await createMeeting(token, 'Meeting 2');

      const res = await request(app.getHttpServer())
        .get('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.map((m: { title: string }) => m.title)).toContain('Meeting 1');
      expect(res.body.map((m: { title: string }) => m.title)).toContain('Meeting 2');
    });

    it('should return empty array when user has no meetings', async () => {
      const { token } = await register('empty-list@example.com');

      const res = await request(app.getHttpServer())
        .get('/meetings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer()).get('/meetings').expect(401);
    });

    it('should not leak another user meetings in the list (IDOR on list)', async () => {
      const { token: user1Token } = await register('list-owner@example.com');
      const { token: user2Token } = await register('list-intruder@example.com');

      await createMeeting(user1Token, 'Private Meeting A');
      await createMeeting(user1Token, 'Private Meeting B');

      const res = await request(app.getHttpServer())
        .get('/meetings')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /meetings/:id', () => {
    it('should return a meeting by ID', async () => {
      const { token } = await register('get-meeting@example.com');

      const createRes = await createMeeting(token, 'Target Meeting', '2026-08-01T10:00:00Z', [
        'Charlie',
      ]);

      const meetingId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(meetingId);
      expect(res.body.title).toBe('Target Meeting');
      expect(res.body.participants).toEqual(['Charlie']);
    });

    it('should return 404 when meeting does not exist', async () => {
      const { token } = await register('not-found@example.com');

      await request(app.getHttpServer())
        .get('/meetings/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 when meeting belongs to another user', async () => {
      const { token: user1Token } = await register('owner@example.com');
      const { token: user2Token } = await register('intruder@example.com');

      const createRes = await createMeeting(user1Token, 'Private Meeting');

      await request(app.getHttpServer())
        .get(`/meetings/${createRes.body.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);
    });

    it('should return 404 for a malformed (non-UUID) meeting id instead of 500', async () => {
      const { token } = await register('malformed-id@example.com');

      await request(app.getHttpServer())
        .get('/meetings/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
