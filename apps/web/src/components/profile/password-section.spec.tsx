import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordSection from './password-section';

const mockUseAuth = vi.fn();

const { toastSuccess, toastDanger } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastDanger: vi.fn(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>();
  return {
    ...actual,
    toast: { success: toastSuccess, danger: toastDanger },
  };
});

function renderSection() {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'ivan@example.com', name: 'Иван Петров', hasAvatar: false },
    token: 'jwt-token',
    updateUser: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
  });
  return render(<PasswordSection />);
}

describe('PasswordSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    toastSuccess.mockClear();
    toastDanger.mockClear();
  });

  it('renders new password and confirm password fields', () => {
    renderSection();

    expect(screen.getByLabelText(/новый пароль/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/повторите пароль/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /сменить пароль/i })).toBeInTheDocument();
  });

  it('shows an inline error for a short password and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/новый пароль/i), '123');
    await user.type(screen.getByLabelText(/повторите пароль/i), '123');
    await user.click(screen.getByRole('button', { name: /сменить пароль/i }));

    await waitFor(() => {
      expect(screen.getByText('Пароль должен содержать минимум 6 символов')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an inline error when passwords do not match and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/новый пароль/i), 'newpass123');
    await user.type(screen.getByLabelText(/повторите пароль/i), 'otherpass456');
    await user.click(screen.getByRole('button', { name: /сменить пароль/i }));

    await waitFor(() => {
      expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits PATCH /api/user/password and shows a success toast', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Password updated' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/новый пароль/i), 'newpass123');
    await user.type(screen.getByLabelText(/повторите пароль/i), 'newpass123');
    await user.click(screen.getByRole('button', { name: /сменить пароль/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/user/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token',
        },
        body: JSON.stringify({ password: 'newpass123' }),
      });
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Пароль изменён');
    });
  });

  it('clears the fields after a successful password change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'Password updated' }) }),
    );

    renderSection();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/новый пароль/i), 'newpass123');
    await user.type(screen.getByLabelText(/повторите пароль/i), 'newpass123');
    await user.click(screen.getByRole('button', { name: /сменить пароль/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/новый пароль/i)).toHaveValue('');
    });
    expect(screen.getByLabelText(/повторите пароль/i)).toHaveValue('');
  });

  it('shows an inline error and toast on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Too Many Requests' }),
      }),
    );

    renderSection();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/новый пароль/i), 'newpass123');
    await user.type(screen.getByLabelText(/повторите пароль/i), 'newpass123');
    await user.click(screen.getByRole('button', { name: /сменить пароль/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Слишком много попыток. Попробуйте позже.',
    );
    expect(toastDanger).toHaveBeenCalledWith('Слишком много попыток. Попробуйте позже.');
  });

  it('shows a toast on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    renderSection();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/новый пароль/i), 'newpass123');
    await user.type(screen.getByLabelText(/повторите пароль/i), 'newpass123');
    await user.click(screen.getByRole('button', { name: /сменить пароль/i }));

    await waitFor(() => {
      expect(toastDanger).toHaveBeenCalledWith('Ошибка сети. Попробуйте ещё раз.');
    });
  });
});
