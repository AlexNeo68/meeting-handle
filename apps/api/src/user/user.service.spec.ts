import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getProfile('uuid-123');

      expect(result.id).toBe('uuid-123');
      expect(result.email).toBe('user@example.com');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uuid-123' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateProfile('uuid-123', { name: 'New Name' });

      expect(result.id).toBe('uuid-123');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { name: 'New Name' },
        select: { id: true, email: true, createdAt: true, updatedAt: true },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile('non-existent', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
