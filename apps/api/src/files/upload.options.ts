import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { isAllowedMime, MAX_FILE_SIZE } from '@meeting-ai/shared';
import { sanitizeOriginalName } from '../common/utils/file-name.util';
import { isUuid } from '../common/utils/uuid.util';

export function multerDiskOptions(uploadDir: string): MulterOptions {
  return {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        // The multer destination callback runs BEFORE pipes validate the
        // route params, so the raw (already URL-decoded) meetingId must be
        // validated here. Building the filesystem path from an unvalidated
        // param would allow `../` traversal outside the uploads dir.
        const userId = (req.user as { sub?: string } | undefined)?.sub;
        const meetingId = req.params.meetingId;

        if (!userId || !isUuid(userId) || !meetingId || !isUuid(meetingId)) {
          return cb(new BadRequestException('Invalid user or meeting id'), '');
        }

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
