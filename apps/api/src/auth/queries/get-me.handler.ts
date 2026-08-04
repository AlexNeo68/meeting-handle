import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { toProfile } from '../../common/utils/profile-mapper.util';
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

    return toProfile(user);
  }
}
