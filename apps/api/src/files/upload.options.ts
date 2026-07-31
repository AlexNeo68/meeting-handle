import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { isAllowedMime, MAX_FILE_SIZE } from '@meeting-ai/shared';
import { sanitizeOriginalName } from './file-name.util';

export function multerDiskOptions(uploadDir: string): MulterOptions {
  return {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const userId = (req.user as { sub?: string } | undefined)?.sub ?? '';
        const meetingId = req.params.meetingId;
        const dir = join(uploadDir, userId, meetingId);
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}-${sanitizeOriginalName(file.originalname)}`);
      },
    }),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) =>
      isAllowedMime(file.mimetype)
        ? cb(null, true)
        : cb(new BadRequestException('Unsupported file type'), false),
  };
}
