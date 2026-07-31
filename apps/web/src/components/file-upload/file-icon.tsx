'use client';

import { getFileKind, type FileKind } from '@meeting-ai/shared';
import type { ReactNode } from 'react';

const FILE_GLYPH = (
  <>
    <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <path d="M14 2v4h4" />
  </>
);

const FILE_TYPE_META: Record<FileKind, { label: string; icon: ReactNode }> = {
  audio: {
    label: 'Аудиофайл',
    icon: (
      <>
        <path d="M9 18V6l10-2v12" />
        <path d="M5 16a3 3 0 1 0 4 0V8" />
        <path d="M15 14a3 3 0 1 0 4 0V8" />
      </>
    ),
  },
  video: {
    label: 'Видеофайл',
    icon: (
      <>
        <rect x="3" y="5" width="14" height="14" rx="2" />
        <path d="M17 10l4-2v8l-4-2" />
      </>
    ),
  },
  pdf: {
    label: 'PDF-документ',
    icon: (
      <>
        {FILE_GLYPH}
        <path d="M8 12h8M8 15h5M8 9h3" />
      </>
    ),
  },
  doc: {
    label: 'Документ',
    icon: (
      <>
        {FILE_GLYPH}
        <path d="M8 12h8M8 15h8" />
      </>
    ),
  },
  other: {
    label: 'Файл',
    icon: FILE_GLYPH,
  },
};

export function fileTypeLabel(mimeType: string): string {
  return FILE_TYPE_META[getFileKind(mimeType)].label;
}

interface FileTypeIconProps {
  mimeType: string;
  className?: string;
  hideLabel?: boolean;
}

export function FileTypeIcon({ mimeType, className, hideLabel }: FileTypeIconProps) {
  const kind = getFileKind(mimeType);
  const meta = FILE_TYPE_META[kind];

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
        data-file-type={kind}
      >
        {meta.icon}
      </svg>
      {!hideLabel && <span className="sr-only">{meta.label}</span>}
    </>
  );
}
