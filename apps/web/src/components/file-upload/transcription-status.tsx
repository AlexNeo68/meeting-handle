'use client';

import { Chip, ProgressBar } from '@heroui/react';
import { translateApiError } from '@/lib/api-errors';
import type { MeetingFile } from './file-upload';

interface TranscriptionStatusProps {
  status: MeetingFile['transcriptionStatus'];
  progress?: number | null;
  error?: string | null;
  language?: string | null;
  compact?: boolean;
}

export default function TranscriptionStatus({
  status,
  progress,
  error,
  language,
  compact = false,
}: TranscriptionStatusProps) {
  if (status == null) {
    return null;
  }

  if (status === 'PROCESSING') {
    return (
      <div className="flex flex-col gap-1">
        <ProgressBar.Root
          value={progress ?? undefined}
          isIndeterminate={progress == null}
          aria-label="Транскрибация"
          className="w-full"
        >
          <ProgressBar.Output className={compact ? 'text-xs text-muted' : 'text-sm text-muted'}>
            {`Транскрибация…${progress == null ? '' : ` ${progress}%`}`}
          </ProgressBar.Output>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar.Root>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <p
        role="alert"
        aria-live="polite"
        className={compact ? 'text-xs text-danger' : 'text-sm text-danger'}
      >
        {translateApiError(error)}
      </p>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <Chip size="sm" color="success" variant="soft" role="status" aria-live="polite">
        {language ? `Готово · ${language}` : 'Готово'}
      </Chip>
    );
  }

  return (
    <Chip size="sm" color="default" variant="soft" role="status" aria-live="polite">
      В очереди
    </Chip>
  );
}
