import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventBus } from '@nestjs/cqrs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterCommand } from './register.command';
import { RegisterHandler } from './register.handler';
import * as bcrypt from 'bcrypt';

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let eventBus: EventBus;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
    eventBus = module.get<EventBus>(EventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a user, publish event, and return a JWT token', async () => {
    const command = new RegisterCommand('user@example.com', 'password123');
    const hashedPassword = await bcrypt.hash(command.password, 10);

    mockPrisma.user.create.mockResolvedValue({
      id: 'uuid-123',
      email: command.email,
      password: hashedPassword,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handler.execute(command);

    expect(result.token).toBe('test-jwt-token');
    expect(result.userId).toBe('uuid-123');
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: command.email,
        password: expect.any(String),
        name: null,
      },
    });
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(bcrypt.compareSync(command.password, hashedPassword)).toBe(true);
  });

  it('should throw ConflictException when email already exists (create races, P2002)', async () => {
    const command = new RegisterCommand('existing@example.com', 'password123');

    mockPrisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '7.9.0', meta: { target: ['email'] } },
      ),
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should normalize the email before creating the user', async () => {
    const command = new RegisterCommand('  USER@Example.COM  ', 'password123');

    mockPrisma.user.create.mockResolvedValue({
      id: 'uuid-321',
      email: 'user@example.com',
      password: 'hashed',
      tokenVersion: 0,
    });

    await handler.execute(command);

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'user@example.com',
        password: expect.any(String),
        name: null,
      },
    });
  });

  it('should persist trimmed name on create', async () => {
    const command = new RegisterCommand('named@example.com', 'password123', '  Alice  ');

    mockPrisma.user.create.mockResolvedValue({
      id: 'uuid-456',
      email: command.email,
      password: 'hashed',
      name: 'Alice',
    });

    await handler.execute(command);

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: command.email,
        password: expect.any(String),
        name: 'Alice',
      },
    });
  });

  it('should persist null name when name is missing or blank', async () => {
    const command = new RegisterCommand('blank@example.com', 'password123', '   ');

    mockPrisma.user.create.mockResolvedValue({
      id: 'uuid-789',
      email: command.email,
      password: 'hashed',
      name: null,
    });

    await handler.execute(command);

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: command.email,
        password: expect.any(String),
        name: null,
      },
    });
  });
});
