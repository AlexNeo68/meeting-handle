'use client';

import {
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Spinner,
  TextField,
} from '@heroui/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import GuestOnly from '@/components/guest-only';

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function validateEmail(value: string): string | null {
  if (!value) return 'Введите email';
  if (!EMAIL_REGEX.test(value)) return 'Введите корректный email адрес';
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return 'Введите пароль';
  return null;
}

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так. Попробуйте снова');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md px-2 sm:px-6">
        <Card.Header>
          <Card.Title>Вход в аккаунт</Card.Title>
          <Card.Description>Войдите, чтобы продолжить работу с Meeting AI</Card.Description>
        </Card.Header>

        <Form aria-label="Форма входа" className="w-full" onSubmit={onSubmit}>
          <Card.Content className="w-full">
            <div className="flex flex-col gap-4">
              {error && (
                <div
                  aria-live="polite"
                  className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <TextField
                isRequired
                name="email"
                type="email"
                validate={validateEmail}
                value={email}
                onChange={setEmail}
              >
                <Label>Email</Label>
                <Input
                  autoComplete="email"
                  className="w-full"
                  placeholder="you@example.com"
                  variant="secondary"
                />
                <FieldError />
              </TextField>

              <TextField
                isRequired
                name="password"
                type="password"
                validate={validatePassword}
                value={password}
                onChange={setPassword}
              >
                <Label>Пароль</Label>
                <Input
                  autoComplete="current-password"
                  className="w-full"
                  placeholder="Введите пароль"
                  variant="secondary"
                />
                <FieldError />
              </TextField>
            </div>
          </Card.Content>

          <Card.Footer className="mt-4 flex flex-col gap-3">
            <Button fullWidth isDisabled={isLoading} isPending={isLoading} type="submit">
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  {isPending ? 'Вход...' : 'Войти'}
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted">
              Нет аккаунта?{' '}
              <Link className="text-sm" href="/signup">
                Зарегистрироваться
              </Link>
            </p>
          </Card.Footer>
        </Form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <GuestOnly>
      <LoginForm />
    </GuestOnly>
  );
}
