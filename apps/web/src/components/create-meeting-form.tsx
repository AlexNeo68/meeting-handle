'use client';

import {
  Button,
  Card,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface CreateMeetingFormProps {
  onCreated: () => void;
}

function validateTitle(value: string): string | null {
  if (!value.trim()) return 'Введите название встречи';
  return null;
}

function validateDate(value: string): string | null {
  if (!value) return 'Выберите дату встречи';
  return null;
}

export default function CreateMeetingForm({ onCreated }: CreateMeetingFormProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [participantsInput, setParticipantsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);

      const participants = participantsInput
        .split(',')
        .map((participant) => participant.trim())
        .filter(Boolean);

      try {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            date: new Date(date).toISOString(),
            participants,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Ошибка создания встречи');
        }

        setTitle('');
        setDate('');
        setParticipantsInput('');
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так. Попробуйте снова');
      } finally {
        setIsLoading(false);
      }
    },
    [title, date, participantsInput, token, onCreated],
  );

  return (
    <Card>
      <Card.Header>
        <Card.Title>Новая встреча</Card.Title>
        <Card.Description>Запланируйте встречу, чтобы загружать в неё материалы</Card.Description>
      </Card.Header>

      <Form aria-label="Форма создания встречи" className="w-full" onSubmit={onSubmit}>
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

            <TextField isRequired name="title" validate={validateTitle} value={title} onChange={setTitle}>
              <Label>Название</Label>
              <Input
                autoComplete="off"
                className="w-full"
                placeholder="Например, Sprint Planning"
                variant="secondary"
              />
              <FieldError />
            </TextField>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField isRequired name="date" type="datetime-local" validate={validateDate} value={date} onChange={setDate}>
                <Label>Дата и время</Label>
                <Input className="w-full" variant="secondary" />
                <FieldError />
              </TextField>

              <TextField name="participants" value={participantsInput} onChange={setParticipantsInput}>
                <Label>Участники</Label>
                <Input
                  autoComplete="off"
                  className="w-full"
                  placeholder="Иван, Мария, Пётр"
                  variant="secondary"
                />
                <Description>Участники через запятую</Description>
              </TextField>
            </div>
          </div>
        </Card.Content>

        <Card.Footer className="mt-2">
          <Button fullWidth isDisabled={isLoading} isPending={isLoading} type="submit">
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : null}
                {isPending ? 'Создание...' : 'Создать встречу'}
              </>
            )}
          </Button>
        </Card.Footer>
      </Form>
    </Card>
  );
}
