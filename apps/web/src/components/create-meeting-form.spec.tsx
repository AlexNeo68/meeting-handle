import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CreateMeetingForm from './create-meeting-form';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('CreateMeetingForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockUseAuth.mockReturnValue({ token: 'jwt-token' });
  });

  it('renders title, date, participants fields and submit button', () => {
    render(<CreateMeetingForm onCreated={vi.fn()} />);

    expect(screen.getByLabelText(/название/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/дата и время/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/участники/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /создать встречу/i })).toBeInTheDocument();
  });

  it('posts a meeting and calls onCreated', async () => {
    const onCreated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'meeting-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CreateMeetingForm onCreated={onCreated} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/название/i), 'Sprint Planning');
    fireEvent.change(screen.getByLabelText(/дата и время/i), {
      target: { value: '2026-08-01T10:00' },
    });
    await user.type(screen.getByLabelText(/участники/i), 'Иван, Мария');

    await user.click(screen.getByRole('button', { name: /создать встречу/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token',
        },
        body: JSON.stringify({
          title: 'Sprint Planning',
          date: new Date('2026-08-01T10:00').toISOString(),
          participants: ['Иван', 'Мария'],
        }),
      });
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it('clears fields after successful creation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    render(<CreateMeetingForm onCreated={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/название/i), 'Standup');
    fireEvent.change(screen.getByLabelText(/дата и время/i), {
      target: { value: '2026-08-01T10:00' },
    });
    await user.click(screen.getByRole('button', { name: /создать встречу/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/название/i)).toHaveValue('');
    });
    expect(screen.getByLabelText(/дата и время/i)).toHaveValue('');
  });

  it('shows error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Ошибка создания встречи' }),
      }),
    );

    render(<CreateMeetingForm onCreated={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/название/i), 'Test');
    fireEvent.change(screen.getByLabelText(/дата и время/i), {
      target: { value: '2026-08-01T10:00' },
    });
    await user.click(screen.getByRole('button', { name: /создать встречу/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ошибка создания встречи');
  });
});
