import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignupPage from './page';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    login: vi.fn(),
    isAuthenticated: false,
    user: null,
    token: null,
    logout: vi.fn(),
  }),
}));

const mockUser = {
  id: 'user-1',
  email: 'new@example.com',
  name: null,
  hasAvatar: false,
};

function renderPage() {
  return render(<SignupPage />);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email/i), 'new@example.com');
  await user.type(screen.getByLabelText('Пароль'), 'password123');
  await user.type(screen.getByLabelText(/подтвердите пароль/i), 'password123');
  await user.click(screen.getByRole('checkbox', { name: /я согласен с условиями/i }));
}

describe('SignupPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockPush.mockClear();
  });

  it('renders email, password, confirm password, terms and the submit button', () => {
    renderPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
    expect(screen.getByLabelText(/подтвердите пароль/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /я согласен с условиями/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /зарегистрироваться/i })).toBeInTheDocument();
  });

  it('shows a link to the login page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /войти/i })).toHaveAttribute('href', '/login');
  });

  it('shows validation errors and does not submit when terms are not accepted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'password123');
    await user.type(screen.getByLabelText(/подтвердите пароль/i), 'password123');
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(screen.getByText('Необходимо принять условия')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for a short password and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText('Пароль'), '123');
    await user.type(screen.getByLabelText(/подтвердите пароль/i), '123');
    await user.click(screen.getByRole('checkbox', { name: /я согласен с условиями/i }));
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(screen.getByText('Пароль должен содержать минимум 6 символов')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a validation error when passwords do not match and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'password123');
    await user.type(screen.getByLabelText(/подтвердите пароль/i), 'different456');
    await user.click(screen.getByRole('checkbox', { name: /я согласен с условиями/i }));
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for an invalid email and does not submit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText('Пароль'), 'password123');
    await user.type(screen.getByLabelText(/подтвердите пароль/i), 'password123');
    await user.click(screen.getByRole('checkbox', { name: /я согласен с условиями/i }));
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(screen.getByText('Введите корректный email адрес')).toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers via POST /api/auth/register, stores the session and shows the success screen', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-token', userId: 'user-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', password: 'password123' }),
      });
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/user/profile', {
      headers: { Authorization: 'Bearer jwt-token' },
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Добро пожаловать!' })).toBeInTheDocument();
    });
    expect(screen.getByText('new@example.com')).toBeInTheDocument();

    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it('shows an error alert when the email is already registered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Email already exists' }),
      }),
    );
    const user = userEvent.setup();

    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email already exists');
    expect(screen.queryByRole('heading', { name: 'Добро пожаловать!' })).not.toBeInTheDocument();
  });

  it('navigates to the dashboard from the success screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'jwt-token', userId: 'user-1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        }),
    );
    const user = userEvent.setup();

    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

    const dashboardButton = await screen.findByRole('button', { name: /перейти к дашборду/i });
    await user.click(dashboardButton);

    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
