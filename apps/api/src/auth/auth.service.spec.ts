import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = { email: 'user@example.com', password: 'password123' };

    it('should create a user and return a JWT token', async () => {
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'uuid-123',
        email: registerDto.email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result.token).toBe('test-jwt-token');
      expect(result.user).toEqual({
        id: 'uuid-123',
        email: registerDto.email,
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          password: expect.any(String),
        },
      });
      expect(
        bcrypt.compareSync(registerDto.password, hashedPassword),
      ).toBe(true);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = { email: 'user@example.com', password: 'password123' };

    it('should return a JWT token for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash(loginDto.password, 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: loginDto.email,
        password: hashedPassword,
      });

      const result = await service.login(loginDto);

      expect(result.token).toBe('test-jwt-token');
      expect(result.user).toEqual({
        id: 'uuid-123',
        email: loginDto.email,
      });
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: loginDto.email,
        password: hashedPassword,
      });

      await expect(
        service.login({
          email: loginDto.email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
