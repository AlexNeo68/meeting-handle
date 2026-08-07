import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FileItem from './file-item';
import type { MeetingFile } from './file-upload';

const { toastDanger } = vi.hoisted(() => ({ toastDanger: vi.fn() }));

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    toast: { danger: toastDanger },
  };
});

function makeFile(overrides: Partial<MeetingFile> = {}): MeetingFile {
  return {
    id: 'file-1',
    originalName: 'запись.mp3',
    mimeType: 'audio/mpeg',
    size: 1024,
    createdAt: '2026-07-30T09:00:00.000Z',
    transcriptionStatus: null,
    transcriptionProgress: null,
    transcriptionError: null,
    transcriptionLanguage: null,
    ...overrides,
  };
}

function renderItem(file = makeFile()) {
  const onDeleted = vi.fn();
  const onTranscriptionChange = vi.fn();
  const utils = render(
    <FileItem
      file={file}
      meetingId="meeting-1"
      token="jwt-token"
      onDeleted={onDeleted}
      onTranscriptionChange={onTranscriptionChange}
    />,
  );
  return { onDeleted, onTranscriptionChange, ...utils };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FileItem', () => {
  it('does not render a transcription row when there is no transcription', () => {
    renderItem();

    expect(screen.queryByText('В очереди')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить транскрибацию' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Показать транскрипт' })).not.toBeInTheDocument();
  });

  it('shows the status row for a PENDING file', () => {
    renderItem(makeFile({ transcriptionStatus: 'PENDING' }));

    expect(screen.getByText('В очереди')).toBeInTheDocument();
  });

  it('retries a FAILED transcription and notifies the parent on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcriptionStatus: 'PENDING' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { onTranscriptionChange } = renderItem(
      makeFile({ transcriptionStatus: 'FAILED', transcriptionError: 'ffmpeg not found' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Повторить транскрибацию' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/meetings/meeting-1/files/file-1/transcription/retry',
        expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer jwt-token' } }),
      );
    });

    await waitFor(() => {
      expect(onTranscriptionChange).toHaveBeenCalled();
    });
  });

  it('shows a translated toast when the retry fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Transcription already in progress' }),
      }),
    );

    renderItem(makeFile({ transcriptionStatus: 'FAILED', transcriptionError: 'ffmpeg not found' }));

    fireEvent.click(screen.getByRole('button', { name: 'Повторить транскрибацию' }));

    await waitFor(() => {
      expect(toastDanger).toHaveBeenCalledWith('Транскрибация уже выполняется');
    });
  });

  it('toggles the transcript panel for a COMPLETED file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ transcript: 'Тест транскрипта', language: 'ru' }),
      }),
    );

    renderItem(
      makeFile({
        transcriptionStatus: 'COMPLETED',
        transcriptionProgress: 100,
        transcriptionLanguage: 'ru',
      }),
    );

    const toggleButton = screen.getByRole('button', { name: 'Показать транскрипт' });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText('Тест транскрипта')).toBeInTheDocument();
    });
    expect(screen.getByText('Язык: ru')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скрыть транскрипт' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть транскрипт' }));

    await waitFor(() => {
      expect(screen.queryByText('Тест транскрипта')).not.toBeInTheDocument();
    });
  });
});
