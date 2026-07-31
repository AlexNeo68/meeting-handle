'use client';

import { Button, ProgressBar, Spinner, toast } from '@heroui/react';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ['application/msword', 'application/pdf'];
const ALLOWED_MIME_PREFIXES = [
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

export interface MeetingFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface FileUploadProps {
  meetingId: string;
  onUploaded: (file: MeetingFile) => void;
}

export interface FileUploadHandle {
  openDialog: () => void;
}

function parseErrorStatus(text: string, fallback: string): string {
  try {
    const data = JSON.parse(text) as { message?: string };
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

const FileUpload = forwardRef<FileUploadHandle, FileUploadProps>(function FileUpload(
  { meetingId, onUploaded },
  ref,
) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const openDialog = useCallback(() => {
    if (isUploading) return;
    inputRef.current?.click();
  }, [isUploading]);

  useImperativeHandle(ref, () => ({ openDialog }), [openDialog]);

  const uploadFile = useCallback(
    (file: File) => {
      setIsUploading(true);
      setProgress(0);

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/meetings/${meetingId}/files`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as MeetingFile;
            onUploaded(data);
          } catch {
            toast.danger('Не удалось обработать ответ сервера');
          }
          return;
        }
        toast.danger(parseErrorStatus(xhr.responseText, 'Не удалось загрузить файл'));
      };

      xhr.onerror = () => {
        setIsUploading(false);
        toast.danger('Ошибка сети. Попробуйте ещё раз.');
      };

      xhr.onabort = () => {
        setIsUploading(false);
      };

      xhr.send(formData);
    },
    [meetingId, token, onUploaded],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setValidationError(null);

      if (file.size > MAX_FILE_SIZE) {
        setValidationError('Файл слишком большой. Максимальный размер — 100 МБ.');
        return;
      }

      if (!isAllowedMime(file.type)) {
        setValidationError('Неподдерживаемый тип файла.');
        return;
      }

      uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <div>
      <button
        type="button"
        onClick={openDialog}
        className="flex min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-divider bg-background px-6 py-8 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Загрузить файл"
        aria-describedby={validationError ? 'file-upload-error' : undefined}
        aria-disabled={isUploading}
      >
        <svg
          aria-hidden="true"
          className="h-8 w-8 text-muted"
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
        <span className="text-sm text-muted">Перетащите файл сюда или нажмите, чтобы выбрать</span>
        <span className="text-xs text-muted">PDF, DOC, аудио и видео до 100 МБ</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="mt-4 flex flex-col items-center gap-3">
        <Button
          aria-label="Upload file"
          isDisabled={isUploading}
          isPending={isUploading}
          onPress={openDialog}
        >
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Загрузка...' : 'Загрузить файл'}
            </>
          )}
        </Button>

        {isUploading && (
          <ProgressBar.Root value={progress} aria-label="Загрузка файла" className="w-full">
            <ProgressBar.Output className="text-xs text-muted">{progress}%</ProgressBar.Output>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar.Root>
        )}
      </div>

      {validationError && (
        <p id="file-upload-error" role="alert" className="mt-3 text-sm text-danger">
          {validationError}
        </p>
      )}
    </div>
  );
});

export default FileUpload;
