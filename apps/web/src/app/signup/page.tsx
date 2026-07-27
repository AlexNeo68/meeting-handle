'use client';

import {
  Button,
  Card,
  Checkbox,
  Description,
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
import GuestOnly from '@/components/guest-only';

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx={12} cy={12} r={3} />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1={1} y1={1} x2={23} y2={23} />
    </svg>
  );
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function validateEmail(value: string): string | null {
  if (!value) return 'Введите email';
  if (!EMAIL_REGEX.test(value)) return 'Введите корректный email адрес';
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return 'Введите пароль';
  if (value.length < 6) return 'Пароль должен содержать минимум 6 символов';
  return null;
}

function validatePasswordConfirm(value: string, password: string): string | null {
  if (!value) return 'Подтвердите пароль';
  if (value !== password) return 'Пароли не совпадают';
  return null;
}

function validateTerms(isSelected: boolean): string | null {
  if (!isSelected) return 'Необходимо принять условия';
  return null;
}

export default function SignupPage() {
  return (
    <GuestOnly>
      <SignupForm />
    </GuestOnly>
  );
}

function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Ошибка регистрации');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так. Попробуйте снова');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <Card.Header>
            <Card.Title>Добро пожаловать!</Card.Title>
            <Card.Description>Аккаунт успешно создан.</Card.Description>
          </Card.Header>
          <Card.Content>
            <p className="text-sm text-muted">
              Вы вошли как <strong>{email}</strong>
            </p>
          </Card.Content>
          <Card.Footer>
            <Button fullWidth onPress={() => router.push('/')}>
              Перейти к дашборду
            </Button>
          </Card.Footer>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md px-2 sm:px-6">
        <Card.Header>
          <Card.Title>Создать аккаунт</Card.Title>
          <Card.Description>Зарегистрируйтесь, чтобы начать работу с Meeting AI</Card.Description>
        </Card.Header>

        <Form aria-label="Форма регистрации" className="w-full" onSubmit={onSubmit}>
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
                type={showPassword ? 'text' : 'password'}
                validate={validatePassword}
                value={password}
                onChange={setPassword}
              >
                <Label>Пароль</Label>
                <div className="relative w-full">
                  <Input
                    autoComplete="new-password"
                    className="w-full pr-10"
                    placeholder="Минимум 6 символов"
                    variant="secondary"
                  />
                  <button
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
                <Description>Минимум 6 символов</Description>
                <FieldError />
              </TextField>

              <TextField
                isRequired
                name="passwordConfirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                validate={(value) => validatePasswordConfirm(value, password)}
                value={passwordConfirm}
                onChange={setPasswordConfirm}
              >
                <Label>Подтвердите пароль</Label>
                <div className="relative w-full">
                  <Input
                    autoComplete="new-password"
                    className="w-full pr-10"
                    placeholder="Повторите пароль"
                    variant="secondary"
                  />
                  <button
                    aria-label={showPasswordConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    type="button"
                    onClick={() => setShowPasswordConfirm((prev) => !prev)}
                  >
                    <EyeIcon visible={showPasswordConfirm} />
                  </button>
                </div>
                <FieldError />
              </TextField>

              <Checkbox
                isRequired
                name="terms"
                validate={() => validateTerms(termsAccepted)}
                isSelected={termsAccepted}
                onChange={setTermsAccepted}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-sm">
                    Я согласен с{' '}
                    <Link className="text-sm" href="/terms">
                      условиями использования
                    </Link>{' '}
                    и{' '}
                    <Link className="text-sm" href="/privacy">
                      политикой конфиденциальности
                    </Link>
                  </span>
                </Checkbox.Content>
                <FieldError />
              </Checkbox>
            </div>
          </Card.Content>

          <Card.Footer className="mt-4 flex flex-col gap-3">
            <Button fullWidth isDisabled={isLoading} isPending={isLoading} type="submit">
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  {isPending ? 'Создание аккаунта...' : 'Зарегистрироваться'}
                </>
              )}
            </Button>
            <Description className="text-center">
              Уже есть аккаунт?{' '}
              <Link className="text-sm" href="/login">
                Войти
              </Link>
            </Description>
          </Card.Footer>
        </Form>
      </Card>
    </div>
  );
}
