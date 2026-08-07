'use client';

import { Button, Card, Skeleton } from '@heroui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import FileItem from './file-item';
import type { MeetingFile } from './file-upload';

interface FileListProps {
  meetingId: string;
  refreshToken?: number;
  onRequestUpload?: () => void;
}

const POLL_INTERVAL_MS = 3000;

export default function FileList({ meetingId, refreshToken = 0, onRequestUpload }: FileListProps) {
  const { token } = useAuth();
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/meetings/${meetingId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await res.json()) as { files?: MeetingFile[] } | MeetingFile[];

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'message' in data ? String(data.message) : null;
      throw new Error(message || 'Ошибка загрузки файлов');
    }

    return Array.isArray(data) ? data : Array.isArray(data?.files) ? data.files : [];
  }, [meetingId, token]);

  const loadFiles = useCallback(async () => {
    try {
      const list = await fetchFiles();
      setFiles(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setIsLoading(false);
    }
  }, [fetchFiles]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    loadFiles();
  }, [loadFiles, refreshToken]);

  const hasActiveTranscription = useMemo(
    () =>
      files.some(
        (file) =>
          file.transcriptionStatus === 'PROCESSING' || file.transcriptionStatus === 'PENDING',
      ),
    [files],
  );

  useEffect(() => {
    if (!hasActiveTranscription) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (isFetchingRef.current) {
        return;
      }
      isFetchingRef.current = true;
      fetchFiles()
        .then(setFiles)
        .catch(() => undefined)
        .finally(() => {
          isFetchingRef.current = false;
        });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [hasActiveTranscription, fetchFiles]);

  const handleDeleted = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загрузка файлов">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-xl border border-divider px-4 py-3"
          >
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3 w-1/2 rounded" />
              <Skeleton className="mt-2 h-2 w-1/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
      >
        {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <svg
          aria-hidden="true"
          className="mx-auto h-10 w-10 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <p className="mt-3 text-sm text-muted">Файлы ещё не загружены</p>
        {onRequestUpload && (
          <Button className="mt-5 min-h-11" variant="secondary" onPress={onRequestUpload}>
            Загрузить первый файл
          </Button>
        )}
      </Card>
    );
  }

  return (
    <ul role="list" aria-label="Файлы встречи" className="flex flex-col gap-3">
      {files.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          meetingId={meetingId}
          token={token ?? ''}
          onDeleted={handleDeleted}
          onTranscriptionChange={loadFiles}
        />
      ))}
    </ul>
  );
}
