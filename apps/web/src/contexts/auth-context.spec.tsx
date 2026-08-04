// @vitest-environment happy-dom
import { renderHook, act, waitFor } from '@testing-library/react';

import { ReactNode, StrictMode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  hasAvatar: false,
};
const mockToken = 'jwt-token-abc';

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('is not authenticated when no token in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.avatarVersion).toBe(0);
  });

  it('hydrates token immediately and fetches fresh profile via GET /api/auth/me', async () => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify({ ...mockUser, name: 'Stale Name' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockUser }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(mockToken);

    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    expect(fetch).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: `Bearer ${mockToken}` },
    });
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it.each([401, 403])('clears the session when hydration profile fetch fails with %s', async (status) => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ message: 'Unauthorized' }) }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it.each([500, 503])('keeps the session on hydration 5xx (%s) using the localStorage copy', async (status) => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ message: 'Server error' }) }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockToken);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('token')).toBe(mockToken);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it('keeps the session on network error using the localStorage copy', async () => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockToken);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('token')).toBe(mockToken);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it('login calls POST /api/auth/login then GET /api/auth/me and stores token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockToken, userId: mockUser.id }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUser,
        }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/me', {
      headers: { Authorization: `Bearer ${mockToken}` },
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe(mockToken);
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it('login throws on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.login('wrong@example.com', 'wrong');
      } catch (e) {
        expect((e as Error).message).toBe('Invalid credentials');
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout clears localStorage and resets state', async () => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockUser }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('updateUser merges partial into state and localStorage user', async () => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockUser }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    act(() => {
      result.current.updateUser({ name: 'New Name', hasAvatar: true });
    });

    expect(result.current.user).toEqual({ ...mockUser, name: 'New Name', hasAvatar: true });
    expect(localStorage.getItem('user')).toBe(
      JSON.stringify({ ...mockUser, name: 'New Name', hasAvatar: true }),
    );
  });

  it('updateUser writes to localStorage once per call, not inside the setUser updater (StrictMode)', async () => {
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockUser }),
    );

    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <AuthProvider>{children}</AuthProvider>
        </StrictMode>
      ),
    });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    setItemSpy.mockClear();

    act(() => {
      result.current.updateUser({ name: 'New Name' });
    });

    expect(result.current.user).toEqual({ ...mockUser, name: 'New Name' });
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith('user', JSON.stringify({ ...mockUser, name: 'New Name' }));
  });

  it('bumpAvatarVersion increments the avatar version counter', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.avatarVersion).toBe(0);

    act(() => {
      result.current.bumpAvatarVersion();
    });

    expect(result.current.avatarVersion).toBe(1);

    act(() => {
      result.current.bumpAvatarVersion();
    });

    expect(result.current.avatarVersion).toBe(2);
  });
});
