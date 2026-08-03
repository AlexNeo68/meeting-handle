import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Header from './header';

const mockPush = vi.fn();
const mockLogout = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

function mockAuthUser(user: Partial<{ name: string | null; email: string; hasAvatar: boolean }>) {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: null,
      hasAvatar: false,
      ...user,
    },
    isAuthenticated: true,
    token: 'jwt-token',
    login: vi.fn(),
    logout: mockLogout,
  });
}

describe('Header', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockLogout.mockClear();
  });

  it('renders avatar/initials, name and email in the user block', () => {
    mockAuthUser({ name: 'Иван Петров' });

    render(<Header />);

    expect(screen.getByRole('img', { name: 'Иван Петров' })).toBeInTheDocument();
    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('falls back to the email when name is missing', () => {
    mockAuthUser({ name: null });

    render(<Header />);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('navigates to /profile when the user block is clicked', async () => {
    const user = userEvent.setup();
    mockAuthUser({ name: 'Иван Петров' });

    render(<Header />);

    await user.click(screen.getByRole('button', { name: /профиль/i }));

    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    mockAuthUser({ name: 'Иван Петров' });

    render(<Header />);

    await user.click(screen.getByRole('button', { name: /выйти/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
