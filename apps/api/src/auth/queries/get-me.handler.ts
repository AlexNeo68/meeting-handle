import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeQuery } from './get-me.query';

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      select: { id: true, email: true, name: true, avatarStoragePath: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${query.userId}" not found`);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      hasAvatar: user.avatarStoragePath !== null,
    };
  }
}
