import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MeetingDetailPage from './page';

const mockUseAuth = vi.fn();
const mockUseParams = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ push: mockRouterPush }),
}));

const mockMeeting = {
  id: 'meeting-1',
  title: 'Sprint Planning',
  date: '2026-07-28T10:00:00.000Z',
  participants: ['Alice', 'Bob'],
  userId: 'user-1',
  createdAt: '2026-07-25T08:00:00.000Z',
  updatedAt: '2026-07-25T08:00:00.000Z',
};

describe('MeetingDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', email: 'test@example.com' },
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseParams.mockReturnValue({ id: 'meeting-1' });
  });

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<MeetingDetailPage />);

    expect(screen.getByLabelText('Загрузка встречи')).toBeInTheDocument();
  });

  it('renders meeting info', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMeeting,
      }),
    );

    render(<MeetingDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    });

    expect(screen.getByText(/28\.07\.2026/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Участники встречи' })).toBeInTheDocument();
  });

  it('shows error alert on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      }),
    );

    render(<MeetingDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('shows not found message on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Meeting not found' }),
      }),
    );

    render(<MeetingDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Встреча не найдена')).toBeInTheDocument();
    });
  });

  it('renders files section placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMeeting,
      }),
    );

    render(<MeetingDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Файлы встречи' })).toBeInTheDocument();
    });
  });
});
