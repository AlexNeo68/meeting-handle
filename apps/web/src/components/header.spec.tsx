import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Header from './header';

const mockLogout = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    isAuthenticated: true,
    token: 'jwt-token',
    login: vi.fn(),
    logout: mockLogout,
  }),
}));

describe('Header', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('displays user email', () => {
    render(<Header />);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders logout button', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: /выйти/i })).toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup();

    render(<Header />);

    await user.click(screen.getByRole('button', { name: /выйти/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
