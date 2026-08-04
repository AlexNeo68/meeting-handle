import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
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

  describe('POST /auth/register', () => {
    it('should register a new user and return 201 with token and userId', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'newuser@example.com', password: 'password123' })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.userId).toBeDefined();
      expect(typeof res.body.userId).toBe('string');
    });

    it('should persist optional name at registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'named@example.com', password: 'password123', name: '  Alice  ' })
        .expect(201);

      const profile = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(200);

      expect(profile.body.name).toBe('Alice');
    });

    it('should keep name null when registering without name', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'noname@example.com', password: 'password123' })
        .expect(201);

      const profile = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(200);

      expect(profile.body.name).toBeNull();
    });

    it('should return 409 when email already exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'duplicate@example.com', password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'duplicate@example.com', password: 'password123' })
        .expect(409);
    });

    it('should return 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('should return 400 for short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'valid@example.com', password: '12345' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'login-test@example.com', password: 'password123' });
    });

    it('should login and return 200 with token and userId', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login-test@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.userId).toBeDefined();
      expect(typeof res.body.userId).toBe('string');
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login-test@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 for non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /user/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'profile@example.com', password: 'password123' });

      const token = registerRes.body.token;

      const res = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe('profile@example.com');
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBeNull();
      expect(res.body.hasAvatar).toBe(false);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/user/profile').expect(401);
    });
  });

  describe('PATCH /user/profile', () => {
    const register = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' });
      return res.body.token;
    };

    it('should update name and email', async () => {
      const token = await register('patch-profile@example.com');

      const res = await request(app.getHttpServer())
        .patch('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  Alice Smith  ', email: 'alice@example.com' })
        .expect(200);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'alice@example.com',
        name: 'Alice Smith',
        hasAvatar: false,
      });

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(me.body.email).toBe('alice@example.com');
      expect(me.body.name).toBe('Alice Smith');
    });

    it('should return 409 when email is taken by another user', async () => {
      await register('taken-owner@example.com');
      const token = await register('conflict@example.com');

      await request(app.getHttpServer())
        .patch('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'taken-owner@example.com' })
        .expect(409);
    });

    it('should return 400 for invalid email', async () => {
      const token = await register('bad-email@example.com');

      await request(app.getHttpServer())
        .patch('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('should return 400 for empty or too-long name', async () => {
      const token = await register('bad-name@example.com');

      await request(app.getHttpServer())
        .patch('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ' })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'a'.repeat(51) })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).patch('/user/profile').send({ name: 'X' }).expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return profile shape for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'me@example.com', password: 'password123' });

      const token = res.body.token;

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(me.body).toEqual({
        id: expect.any(String),
        email: 'me@example.com',
        name: null,
        hasAvatar: false,
      });
      expect(me.body).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });
});
