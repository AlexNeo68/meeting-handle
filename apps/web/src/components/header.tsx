'use client';

import { Button } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import UserAvatar from '@/components/user-avatar';

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return (
      <header className="flex items-center justify-between border-b border-divider bg-background px-6 py-3">
        <span className="text-lg font-semibold">Meeting AI</span>
      </header>
    );
  }

  const displayName = user.name ?? user.email;

  return (
    <header className="flex items-center justify-between border-b border-divider bg-background px-6 py-3">
      <span className="text-lg font-semibold">Meeting AI</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/profile')}
          aria-label={`Открыть профиль: ${displayName}`}
          className="flex min-h-11 items-center gap-3 rounded-lg px-2 transition-colors duration-150 hover:bg-accent/10 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <UserAvatar size={32} />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">{displayName}</span>
            {user.name && <span className="text-sm text-muted">{user.email}</span>}
          </span>
        </button>
        <Button size="sm" variant="secondary" onPress={logout}>
          Выйти
        </Button>
      </div>
    </header>
  );
}
