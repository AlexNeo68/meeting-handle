import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'a'.repeat(40);
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('should return the user payload when tokenVersion matches', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 2 });
    const payload = { sub: 'user-1', email: 'test@example.com', tokenVersion: 2 };

    const result = await strategy.validate(payload);

    expect(result).toEqual({ sub: 'user-1', email: 'test@example.com' });
  });

  it('should preserve sub as userId for the @UserId decorator', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 });
    const payload = { sub: 'uuid-abc', email: 'user@test.com', tokenVersion: 0 };

    const result = await strategy.validate(payload);

    expect(result.sub).toBe('uuid-abc');
  });

  it('should reject a token whose tokenVersion no longer matches (password changed)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 1 });
    const payload = { sub: 'user-1', email: 'test@example.com', tokenVersion: 0 };

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject a token without a tokenVersion claim', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 });
    const payload = { sub: 'user-1', email: 'test@example.com' };

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject a token for a user that no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const payload = { sub: 'user-1', email: 'test@example.com', tokenVersion: 0 };

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
