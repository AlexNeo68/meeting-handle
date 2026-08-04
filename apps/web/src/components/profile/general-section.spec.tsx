import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GeneralSection from './general-section';

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

const mockUser = {
  id: 'user-1',
  email: 'ivan@example.com',
  name: 'Иван Петров',
  hasAvatar: false,
};

function renderSection() {
  const updateUser = vi.fn();
  mockUseAuth.mockReturnValue({
    user: mockUser,
    token: 'jwt-token',
    updateUser,
  });
  const utils = render(<GeneralSection />);
  return { updateUser, ...utils };
}

describe('GeneralSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    toastSuccess.mockClear();
    toastDanger.mockClear();
  });

  it('renders name and email inputs prefilled from the user', () => {
    renderSection();

    expect(screen.getByLabelText(/имя/i)).toHaveValue('Иван Петров');
    expect(screen.getByLabelText(/email/i)).toHaveValue('ivan@example.com');
    expect(screen.getByRole('button', { name: /сохранить/i })).toBeInTheDocument();
  });

  it('re-syncs the fields with the context after profile hydration', async () => {
    const { rerender } = renderSection();

    expect(screen.getByLabelText(/имя/i)).toHaveValue('Иван Петров');
    expect(screen.getByLabelText(/email/i)).toHaveValue('ivan@example.com');

    const hydratedUser = { ...mockUser, name: 'Иван Обновлённый', email: 'new@example.com' };
    mockUseAuth.mockReturnValue({
      user: hydratedUser,
      token: 'jwt-token',
      updateUser: vi.fn(),
    });
    rerender(<GeneralSection />);

    await waitFor(() => {
      expect(screen.getByLabelText(/имя/i)).toHaveValue('Иван Обновлённый');
      expect(screen.getByLabelText(/email/i)).toHaveValue('new@example.com');
    });
  });

  it('does not overwrite unsaved input when the context user changes', async () => {
    const { rerender } = renderSection();
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/имя/i);
    const emailInput = screen.getByLabelText(/email/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'Иван Введённый');
    await user.clear(emailInput);
    await user.type(emailInput, 'edited@example.com');

    mockUseAuth.mockReturnValue({
      user: { ...mockUser, name: 'Иван Из Контекста', email: 'context@example.com' },
      token: 'jwt-token',
      updateUser: vi.fn(),
    });
    rerender(<GeneralSection />);

    await waitFor(() => {
      expect(nameInput).toHaveValue('Иван Введённый');
      expect(emailInput).toHaveValue('edited@example.com');
    });
  });

  it('submits name and email via PATCH /api/user/profile and calls updateUser', async () => {
    const updatedProfile = { ...mockUser, name: 'Иван Новый' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => updatedProfile,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { updateUser } = renderSection();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/имя/i));
    await user.type(screen.getByLabelText(/имя/i), 'Иван Новый');
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-token',
        },
        body: JSON.stringify({ name: 'Иван Новый', email: 'ivan@example.com' }),
      });
    });

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(updatedProfile);
    });
    expect(toastSuccess).toHaveBeenCalledWith('Профиль обновлён');
  });

  it('shows an inline email error when the email is already taken (409)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Email already exists' }),
      }),
    );

    const { updateUser } = renderSection();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Этот email уже занят');
    expect(updateUser).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('shows an inline error for an invalid email and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(screen.getByText('Введите корректный email адрес')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an inline error for an empty name and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/имя/i));
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(screen.getByText('Введите имя')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an inline error for a name longer than 50 characters', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/имя/i));
    await user.type(screen.getByLabelText(/имя/i), 'И'.repeat(51));
    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(screen.getByText(/не более 50 символов/i)).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('disables the button and shows a spinner while saving', async () => {
    let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );

    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /сохранение/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /сохранение/i })).toHaveAttribute(
      'data-disabled',
      'true',
    );

    resolveFetch!({
      ok: true,
      json: async () => ({ ...mockUser, name: 'Иван Новый' }),
    });
  });

  it('shows a toast and inline error on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    renderSection();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /сохранить/i }));

    await waitFor(() => {
      expect(toastDanger).toHaveBeenCalledWith('Ошибка сети. Попробуйте ещё раз.');
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/ошибка сети/i);
  });
});
