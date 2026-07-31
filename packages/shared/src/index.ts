export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: readonly string[] = ['application/msword', 'application/pdf'];

export const ALLOWED_MIME_PREFIXES: readonly string[] = [
  'audio/',
  'video/',
  'application/vnd.openxmlformats-officedocument.',
];

export const ACCEPT_ATTR =
  'application/pdf,application/msword,audio/*,video/*,application/vnd.openxmlformats-officedocument.*';

export function isAllowedMime(mime: string): boolean {
  return (
    ALLOWED_MIME_TYPES.includes(mime) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
  );
}
