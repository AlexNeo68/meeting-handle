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
import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { translateApiError } from '@/lib/api-errors';

function validateNewPassword(value: string): string | null {
  if (!value) return 'Введите новый пароль';
  if (value.length < 6) return 'Пароль должен содержать минимум 6 символов';
  return null;
}

export default function PasswordSection() {
  const { token } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateConfirm = useCallback(
    (value: string): string | null => {
      if (!value) return 'Повторите новый пароль';
      if (value !== newPassword) return 'Пароли не совпадают';
      return null;
    },
    [newPassword],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSaving(true);
      setError(null);

      try {
        const res = await fetch('/api/user/password', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password: newPassword }),
        });

        const data = (await res.json().catch(() => null)) as { message?: string } | null;

        if (!res.ok) {
          const message = translateApiError(data?.message, 'Не удалось изменить пароль');
          setError(message);
          toast.danger(message);
          return;
        }

        setNewPassword('');
        setConfirmPassword('');
        toast.success('Пароль изменён');
      } catch {
        toast.danger('Ошибка сети. Попробуйте ещё раз.');
      } finally {
        setIsSaving(false);
      }
    },
    [newPassword, token],
  );

  return (
    <Form aria-label="Форма смены пароля" className="w-full" onSubmit={onSubmit}>
      <div className="flex flex-col gap-4">
        {error && (
          <div
            aria-live="polite"
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <TextField
          name="new-password"
          type="password"
          validate={validateNewPassword}
          value={newPassword}
          onChange={setNewPassword}
        >
          <Label>Новый пароль</Label>
          <Input
            autoComplete="new-password"
            className="w-full"
            placeholder="Минимум 6 символов"
            variant="secondary"
          />
          <FieldError />
        </TextField>

        <TextField
          name="confirm-password"
          type="password"
          validate={validateConfirm}
          value={confirmPassword}
          onChange={setConfirmPassword}
        >
          <Label>Повторите пароль</Label>
          <Input autoComplete="new-password" className="w-full" placeholder="Повторите пароль" variant="secondary" />
          <FieldError />
        </TextField>

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
              {isPending ? 'Смена...' : 'Сменить пароль'}
            </>
          )}
        </Button>
      </div>
    </Form>
  );
}
