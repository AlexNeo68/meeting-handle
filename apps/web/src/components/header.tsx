'use client';

import { Button } from '@heroui/react';
import { useAuth } from '@/contexts/auth-context';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-divider bg-background px-6 py-3">
      <span className="text-lg font-semibold">Meeting AI</span>
      <div className="flex items-center gap-4">
        {user && <span className="text-sm text-muted">{user.email}</span>}
        <Button size="sm" variant="secondary" onPress={logout}>
          Выйти
        </Button>
      </div>
    </header>
  );
}
