'use client';

import { ToastProvider } from '@heroui/react';
import { AuthProvider } from '@/contexts/auth-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ToastProvider placement="bottom end" />
    </AuthProvider>
  );
}
