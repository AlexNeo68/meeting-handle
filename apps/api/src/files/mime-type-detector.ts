import { Injectable } from '@nestjs/common';
import { open } from 'node:fs/promises';

export interface MimeTypeDetector {
  detect(absPath: string): Promise<string | null>;
}

@Injectable()
export class FileTypeMimeDetector implements MimeTypeDetector {
  async detect(absPath: string): Promise<string | null> {
    try {
      // file-type is ESM-only; `eval` keeps the dynamic import intact in a CommonJS build.
      // eslint-disable-next-line no-eval
      const { fileTypeFromBuffer } = await eval('import("file-type")');
      const handle = await open(absPath, 'r');
      const head = Buffer.alloc(4100);
      const { bytesRead } = await handle.read(head, 0, 4100, 0);
      await handle.close();
      const detected = await fileTypeFromBuffer(head.subarray(0, bytesRead));
      return detected?.mime ?? null;
    } catch {
      return null;
    }
  }
}
