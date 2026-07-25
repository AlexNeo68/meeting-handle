import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginQuery } from './login.query';
import { LoginHandler } from './login.handler';
import * as bcrypt from 'bcrypt';

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    handler = module.get<LoginHandler>(LoginHandler);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a JWT token for valid credentials', async () => {
    const query = new LoginQuery('user@example.com', 'password123');
    const hashedPassword = await bcrypt.hash(query.password, 10);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-123',
      email: query.email,
      password: hashedPassword,
    });

    const result = await handler.execute(query);

    expect(result.token).toBe('test-jwt-token');
    expect(result.user).toEqual({
      id: 'uuid-123',
      email: query.email,
    });
  });

  it('should throw UnauthorizedException for non-existent email', async () => {
    const query = new LoginQuery('ghost@example.com', 'password123');

    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(handler.execute(query)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    const query = new LoginQuery('user@example.com', 'wrong-password');
    const hashedPassword = await bcrypt.hash('correct-password', 10);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-123',
      email: query.email,
      password: hashedPassword,
    });

    await expect(handler.execute(query)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
