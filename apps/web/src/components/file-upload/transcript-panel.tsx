'use client';

import { Spinner } from '@heroui/react';
import { useEffect, useState } from 'react';
import { translateApiError } from '@/lib/api-errors';

interface TranscriptPanelProps {
  fileId: string;
  meetingId: string;
  token: string;
}

type TranscriptState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; transcript: string; language: string | null };

export default function TranscriptPanel({ fileId, meetingId, token }: TranscriptPanelProps) {
  const [state, setState] = useState<TranscriptState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/files/${fileId}/transcript`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = (await res.json().catch(() => null)) as {
          message?: string;
          transcript?: string;
          language?: string | null;
        } | null;

        if (!res.ok) {
          const message =
            data && typeof data === 'object' && 'message' in data ? String(data.message) : null;
          throw new Error(message || 'Не удалось загрузить транскрипт');
        }

        if (cancelled) return;

        setState({
          status: 'ready',
          transcript: data?.transcript ?? '',
          language: data?.language ?? null,
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Не удалось загрузить транскрипт',
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [fileId, meetingId, token]);

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-label="Загрузка транскрипта"
        className="flex items-center justify-center rounded-lg border border-divider py-6"
      >
        <Spinner color="current" size="sm" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
      >
        {translateApiError(state.message)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-divider px-4 py-3">
      {state.language && <p className="mb-2 text-xs text-muted">Язык: {state.language}</p>}
      <p className="whitespace-pre-wrap break-words text-sm">
        {state.transcript ? state.transcript : 'Речь не распознана. Проверьте качество записи.'}
      </p>
    </div>
  );
}
