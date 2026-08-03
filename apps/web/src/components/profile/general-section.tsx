'use client';

import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { translateApiError } from '@/lib/api-errors';

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function validateName(value: string): string | null {
  if (!value.trim()) return 'Введите имя';
  if (value.trim().length > 50) return 'Имя должно содержать не более 50 символов';
  return null;
}

function validateEmail(value: string): string | null {
  if (!EMAIL_REGEX.test(value)) return 'Введите корректный email адрес';
  return null;
}

export default function GeneralSection() {
  const { user, token, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name !== undefined) {
      setName((prev) => (user.name ?? '') === prev ? prev : user.name ?? '');
    }
    if (user?.email !== undefined) {
      setEmail((prev) => user.email === prev ? prev : user.email);
    }
  }, [user?.name, user?.email]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSaving(true);
      setEmailError(null);
      setFormError(null);

      try {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: name.trim(), email }),
        });

        const data = (await res.json().catch(() => null)) as {
          message?: string;
          id?: string;
          email?: string;
          name?: string | null;
          hasAvatar?: boolean;
        } | null;

        if (!res.ok) {
          if (res.status === 409) {
            setEmailError(translateApiError(data?.message, 'Этот email уже занят'));
            return;
          }
          setFormError(translateApiError(data?.message, 'Не удалось сохранить профиль'));
          return;
        }

        if (data) {
          setName(data.name ?? '');
          setEmail(data.email ?? email);
          updateUser(data);
        }

        toast.success('Профиль обновлён');
      } catch {
        setFormError('Ошибка сети. Попробуйте ещё раз.');
        toast.danger('Ошибка сети. Попробуйте ещё раз.');
      } finally {
        setIsSaving(false);
      }
    },
    [name, email, token, updateUser],
  );

  return (
    <Form aria-label="Форма основных данных" className="w-full" onSubmit={onSubmit}>
      <div className="flex flex-col gap-4">
        {formError && (
          <div
            aria-live="polite"
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        )}

        <TextField name="name" validate={validateName} value={name} onChange={setName}>
          <Label>Имя</Label>
          <Input autoComplete="name" className="w-full" placeholder="Ваше имя" variant="secondary" />
          <FieldError />
        </TextField>

        <TextField name="email" type="email" validate={validateEmail} value={email} onChange={setEmail}>
          <Label>Email</Label>
          <Input
            autoComplete="email"
            className="w-full"
            placeholder="you@example.com"
            variant="secondary"
            aria-describedby={emailError ? 'general-email-error' : undefined}
          />
          <FieldError />
        </TextField>

        {emailError && (
          <p id="general-email-error" role="alert" aria-live="polite" className="text-sm text-danger">
            {emailError}
          </p>
        )}

        <Button
          className="min-h-11"
          fullWidth
          isDisabled={isSaving}
          isPending={isSaving}
          type="submit"
        >
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              {isPending ? 'Сохранение...' : 'Сохранить'}
            </>
          )}
        </Button>
      </div>
    </Form>
  );
}
