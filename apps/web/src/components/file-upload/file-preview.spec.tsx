import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FilePreview from './file-preview';

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    Spinner: () => <div data-testid="spinner" />,
  };
});

function makeFile(
  mimeType: string,
  originalName?: string,
): {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
} {
  return {
    id: 'file-1',
    originalName: originalName ?? 'запись.mp3',
    mimeType,
    size: 1024,
    createdAt: '2026-07-30T09:00:00.000Z',
  };
}

function stubObjectURL() {
  const createObjectURL = vi.fn(() => 'blob:media');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  return { createObjectURL, revokeObjectURL };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FilePreview', () => {
  it('renders an audio player for audio files', async () => {
    stubObjectURL();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }),
      }),
    );

    const { container } = render(
      <FilePreview file={makeFile('audio/mpeg')} meetingId="meeting-1" token="jwt-token" />,
    );

    await waitFor(() => {
      expect(container.querySelector('audio')).toBeInTheDocument();
    });
    expect(container.querySelector('audio')).toHaveAttribute('src', 'blob:media');
  });

  it('renders a video player for video files', async () => {
    stubObjectURL();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['video'], { type: 'video/mp4' }),
      }),
    );

    const { container } = render(
      <FilePreview file={makeFile('video/mp4')} meetingId="meeting-1" token="jwt-token" />,
    );

    await waitFor(() => {
      expect(container.querySelector('video')).toBeInTheDocument();
    });
    expect(container.querySelector('video')).toHaveAttribute('src', 'blob:media');
  });

  it('renders a document icon block for non-media files', () => {
    const { container } = render(
      <FilePreview
        file={makeFile('application/pdf', 'заметки.pdf')}
        meetingId="meeting-1"
        token="jwt-token"
      />,
    );

    expect(screen.getByText('заметки.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 КБ')).toBeInTheDocument();
    expect(screen.getByText('PDF-документ')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('data-file-type', 'pdf');
  });

  it('shows an error alert when the preview request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    render(<FilePreview file={makeFile('audio/mpeg')} meetingId="meeting-1" token="jwt-token" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/превью/i);
    });
  });
});
