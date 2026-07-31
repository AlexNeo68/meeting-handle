import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Next,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NextFunction, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { FilesService } from './files.service';

@Controller('meetings/:meetingId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @UserId() userId: string,
  ) {
    return this.filesService.upload(file, meetingId, userId);
  }

  @Get()
  async findAll(@Param('meetingId', ParseUUIDPipe) meetingId: string, @UserId() userId: string) {
    return this.filesService.findAll(meetingId, userId);
  }

  @Get(':fileId/download')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UserId() userId: string,
  ) {
    const file = await this.filesService.findOwned(fileId, meetingId, userId);
    return this.filesService.download(file);
  }

  @Get(':fileId/preview')
  @Header('X-Content-Type-Options', 'nosniff')
  async preview(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UserId() userId: string,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const file = await this.filesService.findOwned(fileId, meetingId, userId);
    this.filesService.preview(file, res, next);
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UserId() userId: string,
  ) {
    return this.filesService.remove(fileId, meetingId, userId);
  }
}
