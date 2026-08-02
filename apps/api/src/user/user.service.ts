import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarStoragePath: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

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

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: PROFILE_SELECT,
    });

    return this.toProfile(updated);
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
