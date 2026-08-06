import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingService } from './meeting.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
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
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
    @UserId() userId: string,
  ) {
    return this.meetingService.findOne(id, userId);
  }
}
