import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileTypeIcon, fileTypeLabel } from './file-icon';

describe('fileTypeLabel', () => {
  it('maps known mime types to Russian labels', () => {
    expect(fileTypeLabel('audio/mpeg')).toBe('Аудиофайл');
    expect(fileTypeLabel('audio/wav')).toBe('Аудиофайл');
    expect(fileTypeLabel('video/mp4')).toBe('Видеофайл');
    expect(fileTypeLabel('video/webm')).toBe('Видеофайл');
    expect(fileTypeLabel('application/pdf')).toBe('PDF-документ');
    expect(fileTypeLabel('application/msword')).toBe('Документ');
    expect(
      fileTypeLabel('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('Документ');
  });

  it('falls back to a generic label for unknown mime types', () => {
    expect(fileTypeLabel('application/octet-stream')).toBe('Файл');
    expect(fileTypeLabel('')).toBe('Файл');
  });
});

describe('FileTypeIcon', () => {
  it('renders an audio icon with a screen-reader label for audio files', () => {
    render(<FileTypeIcon mimeType="audio/mpeg" />);

    expect(screen.getByText('Аудиофайл')).toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('data-file-type', 'audio');
  });

  it('renders a video icon for video files', () => {
    render(<FileTypeIcon mimeType="video/mp4" />);

    expect(document.querySelector('svg')).toHaveAttribute('data-file-type', 'video');
  });

  it('renders a pdf icon for pdf files', () => {
    render(<FileTypeIcon mimeType="application/pdf" />);

    expect(document.querySelector('svg')).toHaveAttribute('data-file-type', 'pdf');
  });

  it('renders a doc icon for doc and openxml documents', () => {
    const { rerender } = render(<FileTypeIcon mimeType="application/msword" />);
    expect(document.querySelector('svg')).toHaveAttribute('data-file-type', 'doc');

    rerender(
      <FileTypeIcon mimeType="application/vnd.openxmlformats-officedocument.presentationml.presentation" />,
    );
    expect(document.querySelector('svg')).toHaveAttribute('data-file-type', 'doc');
  });

  it('renders a generic icon and label for unknown mime types', () => {
    render(<FileTypeIcon mimeType="application/x-unknown" />);

    expect(document.querySelector('svg')).toHaveAttribute('data-file-type', 'other');
    expect(screen.getByText('Файл')).toBeInTheDocument();
  });

  it('hides the label when hideLabel is set', () => {
    render(<FileTypeIcon mimeType="application/pdf" hideLabel />);

    expect(screen.queryByText('PDF-документ')).not.toBeInTheDocument();
  });

  it('applies a custom className to the svg', () => {
    render(<FileTypeIcon mimeType="application/pdf" className="h-8 w-8" />);

    expect(document.querySelector('svg')).toHaveClass('h-8', 'w-8');
  });
});
