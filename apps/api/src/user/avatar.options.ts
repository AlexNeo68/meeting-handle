import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { ALLOWED_AVATAR_MIME_TYPES, MAX_AVATAR_SIZE } from '@meeting-ai/shared';
import { sanitizeOriginalName } from '../common/utils/file-name.util';

export function avatarDiskOptions(uploadDir: string): MulterOptions {
  return {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const userId = (req.user as { sub?: string } | undefined)?.sub ?? '';
        const dir = join(uploadDir, userId, 'avatar');
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}-${sanitizeOriginalName(file.originalname)}`);
      },
    }),
    limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
    fileFilter: (_req, file, cb) =>
      ALLOWED_AVATAR_MIME_TYPES.includes(file.mimetype)
        ? cb(null, true)
        : cb(new BadRequestException('Unsupported avatar type'), false),
  };
}
