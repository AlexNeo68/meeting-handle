'use client';

import { Spinner } from '@heroui/react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface UserAvatarProps {
  size?: number;
  className?: string;
  isUploading?: boolean;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

export default function UserAvatar({ size = 96, className = '', isUploading = false }: UserAvatarProps) {
  const { user, token, avatarVersion } = useAuth();
  const hasAvatar = user?.hasAvatar ?? false;
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAvatar || !token) {
      setSrc(null);
      setError(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/user/profile/avatar', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Не удалось загрузить аватар');
        }

        const blob = await res.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить аватар');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [hasAvatar, token, avatarVersion]);

  const alt = user?.name ?? user?.email ?? 'Аватар';

  if (isUploading) {
    return (
      <div
        role="status"
        aria-label="Загрузка аватара"
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground ${className}`}
        style={{ width: size, height: size }}
      >
        <Spinner color="current" size="sm" />
      </div>
    );
  }

  if (hasAvatar && src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  if (hasAvatar && !src && !error) {
    return (
      <div
        role="status"
        aria-label="Загрузка аватара"
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground ${className}`}
        style={{ width: size, height: size }}
      >
        <Spinner color="current" size="sm" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {getInitials(user?.name ?? null, user?.email ?? '')}
    </div>
  );
}
