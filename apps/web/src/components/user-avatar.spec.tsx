import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UserAvatar from './user-avatar';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    Spinner: () => <div data-testid="spinner" />,
  };
});

function stubObjectURL() {
  const createObjectURL = vi.fn(() => 'blob:avatar');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  return { createObjectURL, revokeObjectURL };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('UserAvatar', () => {
  it('renders initials from name when user has no avatar', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'ivan@example.com', name: 'Иван Петров', hasAvatar: false },
      token: 'jwt-token',
      avatarVersion: 0,
    });

    render(<UserAvatar />);

    expect(screen.getByRole('img', { name: 'Иван Петров' })).toHaveTextContent('ИП');
  });

  it('renders first char of email when name is missing', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'ivan@example.com', name: null, hasAvatar: false },
      token: 'jwt-token',
      avatarVersion: 0,
    });

    render(<UserAvatar />);

    expect(screen.getByRole('img', { name: 'ivan@example.com' })).toHaveTextContent('I');
  });

  it('fetches the avatar blob when hasAvatar is true', async () => {
    const { createObjectURL } = stubObjectURL();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['avatar'], { type: 'image/png' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'ivan@example.com', name: 'Иван Петров', hasAvatar: true },
      token: 'jwt-token',
      avatarVersion: 0,
    });

    const { container } = render(<UserAvatar />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/user/profile/avatar', {
        headers: { Authorization: 'Bearer jwt-token' },
      });
    });
    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:avatar');
    });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('re-fetches the avatar when avatarVersion changes', async () => {
    stubObjectURL();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['avatar'], { type: 'image/png' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <UserAvatar />
    );

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'ivan@example.com', name: 'Иван Петров', hasAvatar: true },
      token: 'jwt-token',
      avatarVersion: 1,
    });

    rerender(<UserAvatar />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a spinner while the avatar is uploading', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'ivan@example.com', name: 'Иван Петров', hasAvatar: false },
      token: 'jwt-token',
      avatarVersion: 0,
    });

    render(<UserAvatar size={96} isUploading />);

    expect(screen.getByRole('status', { name: 'Загрузка аватара' })).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
