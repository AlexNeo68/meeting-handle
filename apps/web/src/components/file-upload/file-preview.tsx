'use client';

import { Spinner } from '@heroui/react';
import { useEffect, useState } from 'react';
import { FileTypeIcon } from './file-icon';
import type { MeetingFile } from './file-upload';

interface FilePreviewProps {
  file: MeetingFile;
  meetingId: string;
  token: string;
}

export default function FilePreview({ file, meetingId, token }: FilePreviewProps) {
  const isAudio = file.mimeType.startsWith('audio/');
  const isVideo = file.mimeType.startsWith('video/');
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAudio && !isVideo) {
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/files/${file.id}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Не удалось загрузить превью');
        }

        const blob = await res.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить превью');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.id, isAudio, isVideo, meetingId, token]);

  if (!isAudio && !isVideo) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-divider px-4 py-4">
        <FileTypeIcon mimeType={file.mimeType} hideLabel className="h-8 w-8 shrink-0 text-muted" />
        <p className="min-w-0 truncate text-sm text-muted" title={file.originalName}>
          {file.originalName}
        </p>
      </div>
    );
  }

  return (
    <figure className="mt-2">
      {error ? (
        <p role="alert" aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      ) : !src ? (
        <div className="flex items-center justify-center rounded-lg border border-divider py-6">
          <Spinner color="current" size="sm" />
        </div>
      ) : isVideo ? (
        <video controls preload="metadata" src={src} className="w-full rounded-lg" />
      ) : (
        <audio controls src={src} className="w-full" />
      )}
      <figcaption className="mt-1 text-xs text-muted">{file.originalName}</figcaption>
    </figure>
  );
}
