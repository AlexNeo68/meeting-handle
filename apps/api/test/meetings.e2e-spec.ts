import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Meetings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  describe('POST /meetings', () => {
    it('should create a meeting and return 201', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'meeting-create@example.com', password: 'password123' });

      const userId = userRes.body.userId;

      const res = await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', userId)
        .send({
          title: 'Sprint Planning',
          date: '2026-08-01T10:00:00Z',
          participants: ['Alice', 'Bob'],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Sprint Planning');
      expect(res.body.date).toBeDefined();
      expect(res.body.participants).toEqual(['Alice', 'Bob']);
      expect(res.body.userId).toBe(userId);
    });

    it('should return 400 for missing title', async () => {
      await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', 'some-user-id')
        .send({
          date: '2026-08-01T10:00:00Z',
          participants: ['Alice'],
        })
        .expect(400);
    });

    it('should return 400 for invalid date', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid-date@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', userRes.body.userId)
        .send({
          title: 'Bad Date',
          date: 'not-a-date',
          participants: ['Alice'],
        })
        .expect(400);
    });

    it('should return 400 when participants is not an array', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'bad-participants@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', userRes.body.userId)
        .send({
          title: 'Test',
          date: '2026-08-01T10:00:00Z',
          participants: 'not-an-array',
        })
        .expect(400);
    });
  });

  describe('GET /meetings', () => {
    it('should return all meetings for the user', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'meetings-list@example.com', password: 'password123' });
      const userId = userRes.body.userId;

      await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', userId)
        .send({
          title: 'Meeting 1',
          date: '2026-08-01T10:00:00Z',
          participants: ['Alice'],
        });

      await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', userId)
        .send({
          title: 'Meeting 2',
          date: '2026-08-02T10:00:00Z',
          participants: ['Bob'],
        });

      const res = await request(app.getHttpServer())
        .get('/meetings')
        .set('x-user-id', userId)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.map((m: { title: string }) => m.title)).toContain('Meeting 1');
      expect(res.body.map((m: { title: string }) => m.title)).toContain('Meeting 2');
    });

    it('should return empty array when user has no meetings', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'empty-list@example.com', password: 'password123' });
      const userId = userRes.body.userId;

      const res = await request(app.getHttpServer())
        .get('/meetings')
        .set('x-user-id', userId)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /meetings/:id', () => {
    it('should return a meeting by ID', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'get-meeting@example.com', password: 'password123' });
      const userId = userRes.body.userId;

      const createRes = await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', userId)
        .send({
          title: 'Target Meeting',
          date: '2026-08-01T10:00:00Z',
          participants: ['Charlie'],
        });

      const meetingId = createRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set('x-user-id', userId)
        .expect(200);

      expect(res.body.id).toBe(meetingId);
      expect(res.body.title).toBe('Target Meeting');
      expect(res.body.participants).toEqual(['Charlie']);
    });

    it('should return 404 when meeting does not exist', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-found@example.com', password: 'password123' });

      await request(app.getHttpServer())
        .get('/meetings/00000000-0000-0000-0000-000000000000')
        .set('x-user-id', userRes.body.userId)
        .expect(404);
    });

    it('should return 404 when meeting belongs to another user', async () => {
      const user1Res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'owner@example.com', password: 'password123' });
      const user2Res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'intruder@example.com', password: 'password123' });

      const createRes = await request(app.getHttpServer())
        .post('/meetings')
        .set('x-user-id', user1Res.body.user.id)
        .send({
          title: 'Private Meeting',
          date: '2026-08-01T10:00:00Z',
          participants: ['Alice'],
        });

      await request(app.getHttpServer())
        .get(`/meetings/${createRes.body.id}`)
        .set('x-user-id', user2Res.body.user.id)
        .expect(404);
    });
  });
});
