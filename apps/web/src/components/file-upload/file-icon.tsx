'use client';

const DOC_MIME = /^(application\/msword|application\/vnd\.openxmlformats-officedocument\.)/;

export function fileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('audio/')) return 'Аудиофайл';
  if (mimeType.startsWith('video/')) return 'Видеофайл';
  if (mimeType === 'application/pdf') return 'PDF-документ';
  if (DOC_MIME.test(mimeType)) return 'Документ';
  return 'Файл';
}

interface FileTypeIconProps {
  mimeType: string;
  className?: string;
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  let type = 'file';
  let paths: React.ReactNode = (
    <>
      <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v4h4" />
    </>
  );

  if (mimeType.startsWith('audio/')) {
    type = 'audio';
    paths = (
      <>
        <path d="M9 18V6l10-2v12" />
        <path d="M5 16a3 3 0 1 0 4 0V8" />
        <path d="M15 14a3 3 0 1 0 4 0V8" />
      </>
    );
  } else if (mimeType.startsWith('video/')) {
    type = 'video';
    paths = (
      <>
        <rect x="3" y="5" width="14" height="14" rx="2" />
        <path d="M17 10l4-2v8l-4-2" />
      </>
    );
  } else if (mimeType === 'application/pdf') {
    type = 'pdf';
    paths = (
      <>
        <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M8 12h8M8 15h5M8 9h3" />
      </>
    );
  } else if (DOC_MIME.test(mimeType)) {
    type = 'doc';
    paths = (
      <>
        <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M14 2v4h4" />
        <path d="M8 12h8M8 15h8" />
      </>
    );
  }

  return (
    <>
      <svg
        aria-hidden="true"
        className={className ?? 'h-5 w-5 shrink-0 text-muted'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-file-type={type}
      >
        {paths}
      </svg>
      <span className="sr-only">{fileTypeLabel(mimeType)}</span>
    </>
  );
}
