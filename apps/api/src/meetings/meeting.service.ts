import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

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
