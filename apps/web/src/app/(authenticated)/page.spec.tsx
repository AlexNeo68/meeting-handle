import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import HomePage from './page';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockMeetings = [
  {
    id: 'meeting-1',
    title: 'Sprint Planning',
    date: '2026-07-28T10:00:00.000Z',
    participants: ['Alice', 'Bob'],
    userId: 'user-1',
    createdAt: '2026-07-25T08:00:00.000Z',
    updatedAt: '2026-07-25T08:00:00.000Z',
  },
  {
    id: 'meeting-2',
    title: 'Standup',
    date: '2026-07-29T09:00:00.000Z',
    participants: ['Charlie'],
    userId: 'user-1',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:00:00.000Z',
  },
];

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<HomePage />);

    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it('renders list of meetings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMeetings,
      }),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    });

    expect(screen.getByText('Standup')).toBeInTheDocument();
  });

  it('shows empty state when no meetings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/нет встреч/i)).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      }),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('displays meeting date formatted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMeetings,
      }),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    });

    expect(screen.getByText(/28\.07\.2026/)).toBeInTheDocument();
  });

  it('displays participants', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMeetings,
      }),
    );

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText(/Alice, Bob/)).toBeInTheDocument();
    });
  });
});
