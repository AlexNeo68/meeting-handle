'use client';

import { AlertDialog, Button, toast } from '@heroui/react';
import { useState } from 'react';
import { formatDate } from '@/lib/format-date';
import FilePreview from './file-preview';
import type { MeetingFile } from './file-upload';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  let label = 'document';
  let path = (
    <>
      <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v4h4" />
    </>
  );

  if (mimeType.startsWith('audio/')) {
    label = 'audio';
    path = (
      <>
        <path d="M9 18V6l10-2v12" />
        <path d="M5 16a3 3 0 1 0 4 0V8" />
        <path d="M15 14a3 3 0 1 0 4 0V8" />
      </>
    );
  } else if (mimeType.startsWith('video/')) {
    label = 'video';
    path = (
      <>
        <rect x="3" y="5" width="14" height="14" rx="2" />
        <path d="M17 10l4-2v8l-4-2" />
      </>
    );
  } else if (mimeType === 'application/pdf') {
    label = 'pdf';
    path = (
      <>
        <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
        <path d="M8 12h8M8 15h5M8 9h3" />
      </>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-file-type={label}
    >
      {path}
    </svg>
  );
}

interface FileItemProps {
  file: MeetingFile;
  meetingId: string;
  token: string;
  onDeleted: (fileId: string) => void;
}

export default function FileItem({ file, meetingId, token, onDeleted }: FileItemProps) {
  const isMedia = file.mimeType.startsWith('audio/') || file.mimeType.startsWith('video/');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  return (
    <li className="rounded-xl border border-divider bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <FileTypeIcon mimeType={file.mimeType} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.originalName}>
            {file.originalName}
          </p>
          <p className="text-xs text-muted">
            {formatBytes(file.size)} · {formatDate(file.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {isMedia && (
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
          )}

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

      {isPreviewOpen && isMedia && (
        <div id={`preview-${file.id}`}>
          <FilePreview file={file} meetingId={meetingId} token={token} />
        </div>
      )}
    </li>
  );
}
