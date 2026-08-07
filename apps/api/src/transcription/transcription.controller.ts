import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TranscriptionStatus } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { FilesService } from '../files/files.service';
import { TranscriptionService } from './transcription.service';

@Controller('meetings/:meetingId/files/:fileId')
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(
    private readonly filesService: FilesService,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  @Get('transcript')
  async getTranscript(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UserId() userId: string,
  ) {
    const file = await this.filesService.findOwned(fileId, meetingId, userId);

    if (file.transcriptionStatus !== TranscriptionStatus.COMPLETED) {
      throw new ConflictException('Transcription not completed');
    }

    return {
      transcript: file.transcript,
      language: file.transcriptionLanguage,
      transcribedAt: file.transcribedAt,
    };
  }

  @Post('transcription/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retry(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UserId() userId: string,
  ) {
    const file = await this.filesService.findOwned(fileId, meetingId, userId);

    if (file.transcriptionStatus === TranscriptionStatus.FAILED) {
      this.transcriptionService.enqueue(file.id);
      return { transcriptionStatus: TranscriptionStatus.PENDING };
    }

    if (
      file.transcriptionStatus === TranscriptionStatus.PENDING ||
      file.transcriptionStatus === TranscriptionStatus.PROCESSING
    ) {
      throw new BadRequestException('Transcription already in progress');
    }

    throw new BadRequestException('Transcription not available');
  }
}
