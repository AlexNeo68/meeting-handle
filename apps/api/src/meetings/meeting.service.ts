import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

const PAGE_SIZE = 50;

@Injectable()
export class MeetingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMeetingDto, userId: string) {
    return this.prisma.meeting.create({
      data: {
        title: dto.title,
        date: new Date(dto.date),
        participants: dto.participants,
        userId,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.meeting.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: PAGE_SIZE,
    });
  }

  async findOne(id: string, userId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, userId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with id "${id}" not found`);
    }

    return meeting;
  }
}
