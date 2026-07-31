import { basename } from 'node:path';

export function sanitizeOriginalName(name: string): string {
  return (
    basename(String(name ?? ''))
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 120)
  );
}
