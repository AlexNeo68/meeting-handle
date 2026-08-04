import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_AVATAR_SIZE } from '@meeting-ai/shared';
import AvatarSection from './avatar-section';

const mockUseAuth = vi.fn();

const { toastDanger, toastSuccess } = vi.hoisted(() => ({
  toastDanger: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    Spinner: () => <div data-testid="spinner" />,
    toast: { danger: toastDanger, success: toastSuccess },
  };
});

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function renderSection(userOverrides: Partial<{ hasAvatar: boolean }> = {}) {
  const updateUser = vi.fn();
  const bumpAvatarVersion = vi.fn();
  mockUseAuth.mockReturnValue({
    user: {
      id: 'user-1',
      email: 'ivan@example.com',
      name: 'Иван Петров',
      hasAvatar: userOverrides.hasAvatar ?? false,
    },
    token: 'jwt-token',
    avatarVersion: 0,
    updateUser,
    bumpAvatarVersion,
  });
  const utils = render(<AvatarSection />);
  return { updateUser, bumpAvatarVersion, ...utils };
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AvatarSection', () => {
  it('renders the avatar preview and upload button', () => {
    renderSection();

    expect(screen.getByRole('img', { name: 'Иван Петров' })).toHaveTextContent('ИП');
    expect(screen.getByRole('button', { name: /Загрузить аватар/i })).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toHaveAttribute('accept');
  });

  it('shows an inline error when the file exceeds MAX_AVATAR_SIZE', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();

    selectFile(makeFile('big.png', 'image/png', MAX_AVATAR_SIZE + 1));

    expect(screen.getByRole('alert')).toHaveTextContent(/слишком большой/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an inline error when the mime type is not allowed', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();

    selectFile(makeFile('photo.gif', 'image/gif'));

    expect(screen.getByRole('alert')).toHaveTextContent(/неподдерживаемый формат/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a valid file and updates user + avatarVersion on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user-1',
        email: 'ivan@example.com',
        name: 'Иван Петров',
        hasAvatar: true,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { updateUser, bumpAvatarVersion } = renderSection();

    selectFile(makeFile('avatar.png', 'image/png'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/profile/avatar',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer jwt-token' },
        }),
      );
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ hasAvatar: true });
      expect(bumpAvatarVersion).toHaveBeenCalled();
    });
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/обновлён/i));
  });

  it('shows an inline error and toast on a 400 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Unsupported avatar type' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { updateUser, bumpAvatarVersion } = renderSection();

    selectFile(makeFile('avatar.png', 'image/png'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Неподдерживаемый формат изображения.');
    });
    expect(toastDanger).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(bumpAvatarVersion).not.toHaveBeenCalled();
  });

  it('calls DELETE and updates context on successful removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Avatar deleted' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { updateUser, bumpAvatarVersion } = renderSection({ hasAvatar: true });

    fireEvent.click(screen.getByRole('button', { name: 'Удалить аватар' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/profile/avatar',
        expect.objectContaining({
          method: 'DELETE',
          headers: { Authorization: 'Bearer jwt-token' },
        }),
      );
    });

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ hasAvatar: false });
      expect(bumpAvatarVersion).toHaveBeenCalled();
    });
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/удалён/i));
  });

  it('shows an inline error and toast when DELETE fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Failed to delete avatar' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { updateUser, bumpAvatarVersion } = renderSection({ hasAvatar: true });

    fireEvent.click(screen.getByRole('button', { name: 'Удалить аватар' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Не удалось удалить аватар');
    });
    expect(toastDanger).toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(bumpAvatarVersion).not.toHaveBeenCalled();
  });

  it('shows a spinner and disables the button while uploading', async () => {
    let resolveUpload: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderSection();

    selectFile(makeFile('avatar.png', 'image/png'));

    await waitFor(() => {
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Загрузка.../i })).toHaveAttribute(
      'data-disabled',
      'true',
    );

    resolveUpload!({ ok: true, json: async () => ({ hasAvatar: true }) });
  });
});
