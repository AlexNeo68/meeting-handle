import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { TranscriptionStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TranscriptionService } from '../transcription/transcription.service';
import { isAllowedMime, isTranscribableMime, MIME_TYPE_DETECTOR } from './files.constants';
import { MimeTypeDetector } from './mime-type-detector';
import { StoragePathService } from './storage-path.service';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storagePath: StoragePathService,
    @Inject(MIME_TYPE_DETECTOR) private readonly detector: MimeTypeDetector,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  async upload(file: Express.Multer.File, meetingId: string, userId: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    try {
      await this.requireOwnedMeeting(meetingId, userId);

      if (file.size === 0) {
        throw new BadRequestException('Empty file');
      }

      const detected = await this.detector.detect(file.path);
      if (!detected || !isAllowedMime(detected)) {
        throw new BadRequestException('File content does not match allowed types');
      }

      const isTranscribable = isTranscribableMime(detected);

      const record = await this.prisma.meetingFile.create({
        data: {
          storagePath: join(userId, meetingId, basename(file.path)),
          originalName: file.originalname,
          mimeType: detected,
          size: file.size,
          meetingId,
          userId,
          ...(isTranscribable ? { transcriptionStatus: TranscriptionStatus.PENDING } : {}),
        },
      });

      if (isTranscribable) {
        this.transcriptionService.enqueue(record.id);
      }

      return {
        id: record.id,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.size,
        createdAt: record.createdAt,
        transcriptionStatus: record.transcriptionStatus ?? null,
        transcriptionProgress: record.transcriptionProgress ?? null,
      };
    } catch (err) {
      await unlink(file.path).catch(() => undefined);
      throw err;
    }
  }

  async findAll(meetingId: string, userId: string) {
    await this.requireOwnedMeeting(meetingId, userId);

    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId, userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        transcriptionStatus: true,
        transcriptionProgress: true,
        transcriptionError: true,
        transcriptionLanguage: true,
      },
      take: 50,
    });

    return { files };
  }

  async findOwned(fileId: string, meetingId: string, userId: string) {
    const file = await this.prisma.meetingFile.findFirst({
      where: { id: fileId, meetingId, userId },
    });

    if (!file) {
      throw new NotFoundException(`File with id "${fileId}" not found`);
    }

    return file;
  }

  async download(file: { originalName: string; mimeType: string; storagePath: string }) {
    const absPath = this.storagePath.resolve(file.storagePath);

    try {
      await stat(absPath);
    } catch (err) {
      const fsError = err as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw err;
    }

    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;
    return new StreamableFile(createReadStream(absPath), {
      type: file.mimeType,
      disposition,
    });
  }

  preview(
    file: { originalName: string; storagePath: string },
    res: import('express').Response,
    next: import('express').NextFunction,
  ) {
    const absPath = this.storagePath.resolve(file.storagePath);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    res.sendFile(absPath, { acceptRanges: true, dotfiles: 'deny' }, (err) => {
      if (!err) {
        return;
      }
      const fsError = err as NodeJS.ErrnoException;
      next(fsError.code === 'ENOENT' ? new NotFoundException('File not found') : err);
    });
  }

  async remove(fileId: string, meetingId: string, userId: string) {
    const file = await this.findOwned(fileId, meetingId, userId);
    const absPath = this.storagePath.resolve(file.storagePath);

    try {
      await unlink(absPath);
    } catch (err) {
      const fsError = err as NodeJS.ErrnoException;
      if (fsError.code !== 'ENOENT') {
        this.logger.error(`Failed to delete file from disk: ${file.storagePath}`);
        throw err;
      }
      this.logger.warn(`File already missing on disk, removing record: ${file.storagePath}`);
    }

    await this.prisma.meetingFile.delete({ where: { id: file.id } });

    return { message: 'File deleted' };
  }

  private async requireOwnedMeeting(meetingId: string, userId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      select: { id: true },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with id "${meetingId}" not found`);
    }
  }
}
