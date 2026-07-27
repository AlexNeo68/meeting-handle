import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuthenticatedLayout from './layout';

const mockPush = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthenticatedLayout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    mockUseAuth.mockReset();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthenticatedLayout>
        <div>Protected content</div>
      </AuthenticatedLayout>,
    );

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthenticatedLayout>
        <div>Protected content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders header when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com' },
      token: 'jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <AuthenticatedLayout>
        <div>Content</div>
      </AuthenticatedLayout>,
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /выйти/i })).toBeInTheDocument();
  });
});
