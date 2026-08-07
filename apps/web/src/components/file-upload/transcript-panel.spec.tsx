import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TranscriptPanel from './transcript-panel';

function renderPanel() {
  return render(<TranscriptPanel fileId="file-1" meetingId="meeting-1" token="jwt-token" />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TranscriptPanel', () => {
  it('shows a loading state while the transcript is fetched', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    renderPanel();

    expect(screen.getByRole('status', { name: 'Загрузка транскрипта' })).toBeInTheDocument();
  });

  it('renders the transcript and the detected language on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        transcript: 'Привет, это транскрипт.',
        language: 'ru',
        transcribedAt: '2026-08-07T10:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Привет, это транскрипт.')).toBeInTheDocument();
    });
    expect(screen.getByText('Язык: ru')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meetings/meeting-1/files/file-1/transcript',
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt-token' } }),
    );
  });

  it('shows a placeholder when the transcript is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ transcript: '', language: null }),
      }),
    );

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText('Речь не распознана. Проверьте качество записи.'),
      ).toBeInTheDocument();
    });
  });

  it('translates the API error and shows it inside the panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Transcription not completed' }),
      }),
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Транскрибация ещё не завершена');
    });
  });
});
