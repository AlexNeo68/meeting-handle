import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterCommand } from './register.command';
import { RegisterHandler } from './register.handler';
import * as bcrypt from 'bcrypt';

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
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
        RegisterHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a user and return a JWT token', async () => {
    const command = new RegisterCommand('user@example.com', 'password123');
    const hashedPassword = await bcrypt.hash(command.password, 10);

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'uuid-123',
      email: command.email,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handler.execute(command);

    expect(result.token).toBe('test-jwt-token');
    expect(result.user).toEqual({
      id: 'uuid-123',
      email: command.email,
    });
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: command.email,
        password: expect.any(String),
      },
    });
    expect(bcrypt.compareSync(command.password, hashedPassword)).toBe(true);
  });

  it('should throw ConflictException when email already exists', async () => {
    const command = new RegisterCommand('existing@example.com', 'password123');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-id',
      email: command.email,
    });

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
