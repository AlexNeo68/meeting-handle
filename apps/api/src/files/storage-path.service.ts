import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { resolve, sep } from 'node:path';
import { UPLOAD_DIR } from './files.constants';

@Injectable()
export class StoragePathService {
  constructor(@Inject(UPLOAD_DIR) private readonly uploadDir: string) {}

  resolve(storagePath: string): string {
    const base = resolve(this.uploadDir);
    const absPath = resolve(base, storagePath);
    if (!absPath.startsWith(base + sep)) {
      throw new ForbiddenException('Invalid file path');
    }
    return absPath;
  }
}
