export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const PDF_MIME_TYPE = 'application/pdf';
export const MSWORD_MIME_TYPE = 'application/msword';
export const AUDIO_MIME_PREFIX = 'audio/';
export const VIDEO_MIME_PREFIX = 'video/';
export const OPENXML_DOC_MIME_PREFIX = 'application/vnd.openxmlformats-officedocument.';

export const ALLOWED_MIME_TYPES: readonly string[] = [MSWORD_MIME_TYPE, PDF_MIME_TYPE];

export const ALLOWED_MIME_PREFIXES: readonly string[] = [
  AUDIO_MIME_PREFIX,
  VIDEO_MIME_PREFIX,
  OPENXML_DOC_MIME_PREFIX,
];

export const ACCEPT_ATTR = [
  PDF_MIME_TYPE,
  MSWORD_MIME_TYPE,
  'audio/*',
  'video/*',
  `${OPENXML_DOC_MIME_PREFIX}*`,
].join(',');

export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export const ALLOWED_AVATAR_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const AVATAR_ACCEPT_ATTR = ALLOWED_AVATAR_MIME_TYPES.join(',');

export function isAllowedMime(mime: string): boolean {
  return (
    ALLOWED_MIME_TYPES.includes(mime) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
  );
}

export type FileKind = 'audio' | 'video' | 'pdf' | 'doc' | 'other';

export function getFileKind(mime: string): FileKind {
  if (mime.startsWith(AUDIO_MIME_PREFIX)) return 'audio';
  if (mime.startsWith(VIDEO_MIME_PREFIX)) return 'video';
  if (mime === PDF_MIME_TYPE) return 'pdf';
  if (mime === MSWORD_MIME_TYPE || mime.startsWith(OPENXML_DOC_MIME_PREFIX)) return 'doc';
  return 'other';
}

export function isTranscribableMime(mime: string): boolean {
  const kind = getFileKind(mime);
  return kind === 'audio' || kind === 'video';
}
