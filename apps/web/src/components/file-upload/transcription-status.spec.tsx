import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TranscriptionStatus from './transcription-status';

describe('TranscriptionStatus', () => {
  it('renders nothing when status is null', () => {
    const { container } = render(<TranscriptionStatus status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a "В очереди" badge for PENDING', () => {
    render(<TranscriptionStatus status="PENDING" />);

    expect(screen.getByRole('status')).toHaveTextContent('В очереди');
  });

  it('renders the progress bar with a percentage while PROCESSING', () => {
    render(<TranscriptionStatus status="PROCESSING" progress={42} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('Транскрибация… 42%')).toBeInTheDocument();
  });

  it('renders an indeterminate progress bar when PROCESSING without progress', () => {
    render(<TranscriptionStatus status="PROCESSING" progress={null} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('Транскрибация…')).toBeInTheDocument();
  });

  it('translates the error reason for FAILED', () => {
    render(<TranscriptionStatus status="FAILED" error="ffmpeg not found" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('ffmpeg не установлен');
    expect(alert).toHaveClass('text-danger');
  });

  it('uses the fallback message when the FAILED reason is missing', () => {
    render(<TranscriptionStatus status="FAILED" error={null} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Что-то пошло не так. Попробуйте ещё раз.',
    );
  });

  it('renders a "Готово" badge with the detected language for COMPLETED', () => {
    render(<TranscriptionStatus status="COMPLETED" language="ru" />);

    expect(screen.getByRole('status')).toHaveTextContent('Готово · ru');
  });

  it('renders a "Готово" badge without language for COMPLETED', () => {
    render(<TranscriptionStatus status="COMPLETED" language={null} />);

    expect(screen.getByRole('status')).toHaveTextContent('Готово');
  });
});
