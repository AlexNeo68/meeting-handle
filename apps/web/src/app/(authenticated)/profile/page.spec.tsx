import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from './page';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUser = {
  id: 'user-1',
  email: 'ivan@example.com',
  name: 'Иван Петров',
  hasAvatar: false,
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      token: 'jwt-token',
      avatarVersion: 0,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      bumpAvatarVersion: vi.fn(),
    });
  });

  it('shows a skeleton while the user is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      avatarVersion: 0,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
      bumpAvatarVersion: vi.fn(),
    });

    render(<ProfilePage />);

    expect(screen.queryByRole('heading', { name: 'Профиль' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders Avatar, General and Password sections', () => {
    render(<ProfilePage />);

    expect(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();

    expect(screen.getByText('Аватар')).toBeInTheDocument();
    expect(screen.getByText('Основное')).toBeInTheDocument();
    expect(screen.getByText('Пароль')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /загрузить аватар/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/имя/i)).toHaveValue('Иван Петров');
    expect(screen.getByLabelText(/email/i)).toHaveValue('ivan@example.com');

    expect(screen.getByLabelText(/новый пароль/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/повторите пароль/i)).toBeInTheDocument();
  });
});
