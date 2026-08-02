import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
    it('should return profile shape with hasAvatar false when no avatar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        avatarStoragePath: null,
      });

      const result = await service.getProfile('uuid-123');

      expect(result).toEqual({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        hasAvatar: false,
      });
    });

    it('should return hasAvatar true when avatarStoragePath is set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: null,
        avatarStoragePath: 'user-id/avatar/avatar.png',
      });

      const result = await service.getProfile('uuid-123');

      expect(result.hasAvatar).toBe(true);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should trim name and return profile shape', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'New Name',
        avatarStoragePath: null,
      });

      const result = await service.updateProfile('uuid-123', { name: '  New Name  ' });

      expect(result).toEqual({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'New Name',
        hasAvatar: false,
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { name: 'New Name' },
        select: { id: true, email: true, name: true, avatarStoragePath: true },
      });
    });

    it('should skip uniqueness check when email is unchanged', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'uuid-123',
        email: 'user@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: null,
        avatarStoragePath: null,
      });

      await service.updateProfile('uuid-123', { email: 'user@example.com' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: {},
        select: { id: true, email: true, name: true, avatarStoragePath: true },
      });
    });

    it('should throw ConflictException when email is taken by another user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'uuid-123', email: 'user@example.com' })
        .mockResolvedValueOnce({ id: 'other-user', email: 'taken@example.com' });

      await expect(
        service.updateProfile('uuid-123', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should update email when it is available', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'uuid-123', email: 'user@example.com' })
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'new@example.com',
        name: null,
        avatarStoragePath: null,
      });

      const result = await service.updateProfile('uuid-123', { email: 'new@example.com' });

      expect(result.email).toBe('new@example.com');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { email: 'new@example.com' },
        select: { id: true, email: true, name: true, avatarStoragePath: true },
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
