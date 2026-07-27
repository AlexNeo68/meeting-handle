import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Регистрация — Meeting AI',
  description: 'Создайте аккаунт Meeting AI для управления встречами',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
