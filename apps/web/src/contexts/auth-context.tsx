'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface User {
  id: string;
  email: string;
  name: string | null;
  hasAvatar: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  avatarVersion: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  bumpAvatarVersion: () => void;
}

class ProfileFetchError extends Error {
  status: number;

  constructor(status: number) {
    super('Не удалось загрузить профиль');
    this.name = 'ProfileFetchError';
    this.status = status;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);

  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchProfile = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new ProfileFetchError(res.status);
    }

    return (await res.json()) as User;
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (!storedToken) {
      return;
    }

    setToken(storedToken);

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }

    let cancelled = false;

    fetchProfile(storedToken)
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        localStorage.setItem('user', JSON.stringify(profile));
      })
      .catch((error) => {
        if (cancelled) return;

        // Clear the session only on auth errors (401/403). Transient failures
        // (network, 5xx) must keep the user logged in with the storage copy.
        if (error instanceof ProfileFetchError && (error.status === 401 || error.status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Ошибка авторизации');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);

      const profile = await fetchProfile(data.token);
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    },
    [fetchProfile],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback(
    (partial: Partial<User>) => {
      if (!userRef.current) return;
      const next = { ...userRef.current, ...partial };
      userRef.current = next;
      setUser(next);
      localStorage.setItem('user', JSON.stringify(next));
    },
    [],
  );

  const bumpAvatarVersion = useCallback(() => {
    setAvatarVersion((v) => v + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      avatarVersion,
      login,
      logout,
      updateUser,
      bumpAvatarVersion,
    }),
    [user, token, avatarVersion, login, logout, updateUser, bumpAvatarVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
