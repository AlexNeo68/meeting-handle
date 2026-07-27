import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: JwtService, useValue: mockJwtService }],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return user payload with sub and email', async () => {
    const payload = { sub: 'user-1', email: 'test@example.com' };

    const result = await strategy.validate(payload);

    expect(result).toEqual({ sub: 'user-1', email: 'test@example.com' });
  });

  it('should preserve sub as userId for the @UserId decorator', async () => {
    const payload = { sub: 'uuid-abc', email: 'user@test.com' };

    const result = await strategy.validate(payload);

    expect(result.sub).toBe('uuid-abc');
  });
});
