import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { isAllowedMime, MIME_TYPE_DETECTOR, UPLOAD_DIR } from './files.constants';
import { MimeTypeDetector } from './mime-type-detector';
import { sanitizeOriginalName } from './file-name.util';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(UPLOAD_DIR) private readonly uploadDir: string,
    @Inject(MIME_TYPE_DETECTOR) private readonly detector: MimeTypeDetector,
  ) {}

  async upload(file: Express.Multer.File, meetingId: string, userId: string) {
    await this.requireOwnedMeeting(meetingId, userId);

    const detected = await this.detector.detect(file.path);
    if (!detected || !isAllowedMime(detected)) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException('File content does not match allowed types');
    }

    const record = await this.prisma.meetingFile.create({
      data: {
        storageName: basename(file.path),
        originalName: sanitizeOriginalName(file.originalname),
        mimeType: detected,
        size: file.size,
        meetingId,
        userId,
      },
    });

    return {
      id: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      createdAt: record.createdAt,
    };
  }

  async findAll(meetingId: string, userId: string) {
    await this.requireOwnedMeeting(meetingId, userId);

    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      files: files.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt,
      })),
    };
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

  download(
    file: { originalName: string; mimeType: string; storageName: string },
    userId: string,
    meetingId: string,
  ) {
    const absPath = this.resolveStoredPath(userId, meetingId, file.storageName);
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;
    return new StreamableFile(createReadStream(absPath), {
      type: file.mimeType,
      disposition,
    });
  }

  preview(
    file: { originalName: string; storageName: string },
    userId: string,
    meetingId: string,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) {
    const absPath = this.resolveStoredPath(userId, meetingId, file.storageName);
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

    await this.prisma.meetingFile.delete({ where: { id: file.id } });

    try {
      await unlink(this.resolveStoredPath(userId, meetingId, file.storageName));
    } catch (err) {
      this.logger.warn(
        `Orphaned file on disk after DB delete: ${file.storageName} (${(err as Error).message})`,
      );
    }

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

  private resolveStoredPath(userId: string, meetingId: string, storageName: string): string {
    const base = resolve(this.uploadDir, userId, meetingId);
    const absPath = resolve(base, storageName);
    if (!absPath.startsWith(base + sep)) {
      throw new ForbiddenException('Invalid file path');
    }
    return absPath;
  }
}
