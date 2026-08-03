import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MIME_TYPE_DETECTOR, UPLOAD_DIR } from '../files/files.constants';
import { UserService } from './user.service';

jest.mock('node:fs', () => {
  const actual = jest.requireActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    createReadStream: jest.fn(() => Readable.from(Buffer.from('avatar-bytes'))),
  };
});

jest.mock('node:fs/promises');

describe('UserService', () => {
  let service: UserService;
  let uploadDir: string;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDetector = {
    detect: jest.fn(),
  };

  beforeAll(() => {
    uploadDir = mkdtempSync(join(tmpdir(), 'uploads-test-'));
  });

  afterAll(() => {
    rmSync(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UPLOAD_DIR, useValue: uploadDir },
        { provide: MIME_TYPE_DETECTOR, useValue: mockDetector },
      ],
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

  describe('uploadAvatar', () => {
    const file = (path: string): Express.Multer.File =>
      ({
        path,
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: 100,
        filename: 'avatar.png',
      }) as Express.Multer.File;

    it('should persist avatarStoragePath, unlink old avatar and return hasAvatar true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        avatarStoragePath: 'uuid-123/avatar/old.png',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        avatarStoragePath: 'uuid-123/avatar/avatar.png',
      });
      (unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.uploadAvatar('uuid-123', file('/uploads/uuid-123/avatar/avatar.png'));

      expect(unlink).toHaveBeenCalledWith(join(uploadDir, 'uuid-123/avatar/old.png'));
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { avatarStoragePath: 'uuid-123/avatar/avatar.png' },
        select: { id: true, email: true, name: true, avatarStoragePath: true },
      });
      expect(result).toEqual({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        hasAvatar: true,
      });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.uploadAvatar('uuid-123')).rejects.toThrow(BadRequestException);
    });

    it('should unlink new file and rethrow when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (unlink as jest.Mock).mockResolvedValue(undefined);

      await expect(service.uploadAvatar('uuid-123', file('/uploads/new/avatar.png'))).rejects.toThrow(
        NotFoundException,
      );

      expect(unlink).toHaveBeenCalledWith('/uploads/new/avatar.png');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should log and continue when old avatar unlink fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: null,
        avatarStoragePath: 'uuid-123/avatar/old.png',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: null,
        avatarStoragePath: 'uuid-123/avatar/avatar.png',
      });
      (unlink as jest.Mock).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await service.uploadAvatar('uuid-123', file('/uploads/uuid-123/avatar/avatar.png'));

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(result.hasAvatar).toBe(true);
    });
  });

  describe('removeAvatar', () => {
    it('should unlink the avatar file, clear avatarStoragePath and return a message', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        avatarStoragePath: 'uuid-123/avatar/avatar.png',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        avatarStoragePath: null,
      });
      (unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeAvatar('uuid-123');

      expect(unlink).toHaveBeenCalledWith(join(uploadDir, 'uuid-123/avatar/avatar.png'));
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { avatarStoragePath: null },
        select: { id: true },
      });
      expect(result).toEqual({ message: 'Avatar deleted' });
    });

    it('should clear avatarStoragePath even when the file is already missing on disk (ENOENT tolerated)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        avatarStoragePath: 'uuid-123/avatar/ghost.png',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'uuid-123',
        email: 'user@example.com',
        name: null,
        avatarStoragePath: null,
      });
      (unlink as jest.Mock).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      );

      const result = await service.removeAvatar('uuid-123');

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Avatar deleted' });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.removeAvatar('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should hash the password, update it and never return the hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uuid-123' });
      mockPrisma.user.update.mockResolvedValue({ id: 'uuid-123' });

      const result = await service.changePassword('uuid-123', 'newpassword123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { password: expect.any(String) },
        select: { id: true },
      });
      const passwordArg = (mockPrisma.user.update as jest.Mock).mock.calls[0][0].data.password;
      expect(passwordArg).not.toBe('newpassword123');
      expect(bcrypt.compareSync('newpassword123', passwordArg)).toBe(true);
      expect(result).toEqual({ message: 'Password updated' });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.changePassword('non-existent', 'newpassword123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAvatar', () => {
    it('should return StreamableFile with detected content type', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        avatarStoragePath: 'uuid-123/avatar/avatar.png',
      });
      (stat as jest.Mock).mockResolvedValue({ size: 100 });
      mockDetector.detect.mockResolvedValue('image/png');

      const result = await service.getAvatar('uuid-123');

      expect(result).toBeInstanceOf(StreamableFile);
      expect(result.getHeaders().type).toBe('image/png');
    });

    it('should fall back to octet-stream when content type is unknown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        avatarStoragePath: 'uuid-123/avatar/avatar.png',
      });
      (stat as jest.Mock).mockResolvedValue({ size: 100 });
      mockDetector.detect.mockResolvedValue(null);

      const result = await service.getAvatar('uuid-123');

      expect(result.getHeaders().type).toBe('application/octet-stream');
    });

    it('should throw NotFoundException when user has no avatar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'uuid-123', avatarStoragePath: null });

      await expect(service.getAvatar('uuid-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the file is missing on disk', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        avatarStoragePath: 'uuid-123/avatar/ghost.png',
      });
      (stat as jest.Mock).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      await expect(service.getAvatar('uuid-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException on path traversal', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        avatarStoragePath: '../../../../etc/passwd',
      });

      await expect(service.getAvatar('uuid-123')).rejects.toThrow(ForbiddenException);
    });
  });
});
