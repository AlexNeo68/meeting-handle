import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GuestOnly from './guest-only';

const mockPush = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('GuestOnly', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    mockUseAuth.mockReset();
  });

  it('renders children when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <GuestOnly>
        <div>Guest content</div>
      </GuestOnly>,
    );

    expect(screen.getByText('Guest content')).toBeInTheDocument();
  });

  it('redirects to / when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <GuestOnly>
        <div>Guest content</div>
      </GuestOnly>,
    );

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('does not render children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <GuestOnly>
        <div>Guest content</div>
      </GuestOnly>,
    );

    expect(screen.queryByText('Guest content')).not.toBeInTheDocument();
  });
});
