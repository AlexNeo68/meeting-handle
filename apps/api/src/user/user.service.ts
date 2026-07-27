import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
  }
}
