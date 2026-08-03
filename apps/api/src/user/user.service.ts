import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import * as bcrypt from 'bcrypt';
import { ALLOWED_AVATAR_MIME_TYPES } from '@meeting-ai/shared';
import { Prisma } from '../../generated/prisma/client';
import { MIME_TYPE_DETECTOR, UPLOAD_DIR } from '../files/files.constants';
import { MimeTypeDetector } from '../files/mime-type-detector';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarStoragePath: true,
} as const;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(UPLOAD_DIR) private readonly uploadDir: string,
    @Inject(MIME_TYPE_DETECTOR) private readonly detector: MimeTypeDetector,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return this.toProfile(user);
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    const updateData: { name?: string; email?: string } = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.email !== undefined && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('Email already exists');
      }

      updateData.email = data.email;
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: PROFILE_SELECT,
      });

      return this.toProfile(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }
  }

  async uploadAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    try {
      const detected = await this.detector.detect(file.path);
      if (!detected || !ALLOWED_AVATAR_MIME_TYPES.includes(detected)) {
        throw new BadRequestException('Avatar content does not match allowed image types');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatarStoragePath: true },
      });

      if (!user) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }

      const storagePath = join(userId, 'avatar', basename(file.path));

      if (user.avatarStoragePath) {
        await this.removeStoredAvatar(user.avatarStoragePath);
      }

      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarStoragePath: storagePath },
        select: PROFILE_SELECT,
      });

      return this.toProfile(updated);
    } catch (err) {
      await unlink(file.path).catch(() => undefined);
      throw err;
    }
  }

  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStoragePath: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    if (user.avatarStoragePath) {
      await this.removeStoredAvatar(user.avatarStoragePath);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarStoragePath: null },
      select: { id: true },
    });

    return { message: 'Avatar deleted' };
  }

  async getAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarStoragePath: true },
    });

    if (!user?.avatarStoragePath) {
      throw new NotFoundException('Avatar not found');
    }

    const absPath = this.resolveAvatarPath(user.avatarStoragePath);

    try {
      await stat(absPath);
    } catch (err) {
      const fsError = err as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        throw new NotFoundException('Avatar file not found');
      }
      throw err;
    }

    const detected = await this.detector.detect(absPath);
    const mimeType = detected ?? 'application/octet-stream';

    return new StreamableFile(createReadStream(absPath), { type: mimeType });
  }

  async changePassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: { id: true },
    });

    return { message: 'Password updated' };
  }

  private async removeStoredAvatar(storagePath: string) {
    const absPath = this.resolveAvatarPath(storagePath);

    try {
      await unlink(absPath);
    } catch (err) {
      const fsError = err as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        this.logger.warn(`Avatar already missing on disk: ${storagePath}`);
      } else {
        this.logger.error(`Failed to delete old avatar: ${storagePath}`);
      }
    }
  }

  private resolveAvatarPath(storagePath: string): string {
    const base = resolve(this.uploadDir);
    const absPath = resolve(base, storagePath);
    if (!absPath.startsWith(base + sep)) {
      throw new ForbiddenException('Invalid avatar path');
    }
    return absPath;
  }

  private toProfile(user: {
    id: string;
    email: string;
    name: string | null;
    avatarStoragePath: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      hasAvatar: user.avatarStoragePath !== null,
    };
  }
}
