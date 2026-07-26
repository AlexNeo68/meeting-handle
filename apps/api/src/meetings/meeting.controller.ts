import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserId } from '../common/decorators/user-id.decorator';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingService } from './meeting.service';

@Controller('meetings')
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  async create(@Body() dto: CreateMeetingDto, @UserId() userId: string) {
    return this.meetingService.create(dto, userId);
  }

  @Get()
  async findAll(@UserId() userId: string) {
    return this.meetingService.findAllByUser(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @UserId() userId: string) {
    return this.meetingService.findOne(id, userId);
  }
}
