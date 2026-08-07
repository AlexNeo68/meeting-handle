'use client';

import { AlertDialog, Button, toast } from '@heroui/react';
import { useCallback, useState } from 'react';
import { translateApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/format-date';
import { formatFileSize } from '@/lib/format-file-size';
import { FileTypeIcon } from './file-icon';
import FilePreview from './file-preview';
import TranscriptionStatus from './transcription-status';
import TranscriptPanel from './transcript-panel';
import type { MeetingFile } from './file-upload';

interface FileItemProps {
  file: MeetingFile;
  meetingId: string;
  token: string;
  onDeleted: (fileId: string) => void;
  onTranscriptionChange?: () => void;
}

export default function FileItem({
  file,
  meetingId,
  token,
  onDeleted,
  onTranscriptionChange,
}: FileItemProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.danger('Не удалось скачать файл');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.danger('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.danger('Не удалось удалить файл');
        return;
      }

      setIsConfirmOpen(false);
      onDeleted(file.id);
    } catch {
      toast.danger('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/files/${file.id}/transcription/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.danger(translateApiError(data?.message ?? 'Не удалось повторить транскрибацию'));
        return;
      }

      onTranscriptionChange?.();
    } catch {
      toast.danger('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setIsRetrying(false);
    }
  }, [file.id, meetingId, token, onTranscriptionChange]);

  return (
    <li className="rounded-xl border border-divider bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <FileTypeIcon mimeType={file.mimeType} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.originalName}>
            {file.originalName}
          </p>
          <p className="text-xs text-muted">
            {formatFileSize(file.size)} · {formatDate(file.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            aria-label={`Просмотреть ${file.originalName}`}
            aria-expanded={isPreviewOpen}
            aria-controls={`preview-${file.id}`}
            className="min-h-11 min-w-11 sm:min-w-fit"
            size="sm"
            variant="tertiary"
            onPress={() => setIsPreviewOpen((open) => !open)}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
            <span className="hidden sm:inline">{isPreviewOpen ? 'Скрыть' : 'Просмотр'}</span>
          </Button>

          <Button
            aria-label={`Скачать ${file.originalName}`}
            className="min-h-11 min-w-11 sm:min-w-fit"
            size="sm"
            variant="tertiary"
            isDisabled={isDownloading}
            onPress={handleDownload}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
              <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
            </svg>
            <span className="hidden sm:inline">Скачать</span>
          </Button>

          <AlertDialog.Root isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialog.Trigger>
              <Button
                aria-label={`Удалить ${file.originalName}`}
                className="min-h-11 min-w-11 sm:min-w-fit"
                size="sm"
                variant="tertiary"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16" />
                  <path d="M9 7V4h6v3" />
                  <path d="M6 7l1 13h10l1-13" />
                  <path d="M10 11v5M14 11v5" />
                </svg>
                <span className="hidden sm:inline">Удалить</span>
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Backdrop>
              <AlertDialog.Container>
                <AlertDialog.Dialog>
                  <AlertDialog.Header>
                    <AlertDialog.Heading>Удалить файл?</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p className="text-sm text-muted">
                      «{file.originalName}» будет удалён без возможности восстановления.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button
                      variant="tertiary"
                      onPress={() => setIsConfirmOpen(false)}
                      className="min-h-11"
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="primary"
                      className="min-h-11"
                      isDisabled={isDeleting}
                      isPending={isDeleting}
                      onPress={handleDelete}
                    >
                      Удалить
                    </Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog.Root>
        </div>
      </div>

      {file.transcriptionStatus != null && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <TranscriptionStatus
              status={file.transcriptionStatus}
              progress={file.transcriptionProgress}
              error={file.transcriptionError}
              language={file.transcriptionLanguage}
            />
          </div>
          {file.transcriptionStatus === 'FAILED' && (
            <Button
              size="sm"
              variant="tertiary"
              className="min-h-11"
              aria-label="Повторить транскрибацию"
              isDisabled={isRetrying}
              isPending={isRetrying}
              onPress={handleRetry}
            >
              Повторить
            </Button>
          )}
          {file.transcriptionStatus === 'COMPLETED' && (
            <Button
              size="sm"
              variant="tertiary"
              className="min-h-11"
              aria-label={isTranscriptOpen ? 'Скрыть транскрипт' : 'Показать транскрипт'}
              aria-expanded={isTranscriptOpen}
              aria-controls={`transcript-${file.id}`}
              onPress={() => setIsTranscriptOpen((open) => !open)}
            >
              {isTranscriptOpen ? 'Скрыть' : 'Показать транскрипт'}
            </Button>
          )}
        </div>
      )}

      {isTranscriptOpen && (
        <div id={`transcript-${file.id}`} className="mt-2">
          <TranscriptPanel fileId={file.id} meetingId={meetingId} token={token} />
        </div>
      )}

      {isPreviewOpen && (
        <div id={`preview-${file.id}`}>
          <FilePreview file={file} meetingId={meetingId} token={token} />
        </div>
      )}
    </li>
  );
}
