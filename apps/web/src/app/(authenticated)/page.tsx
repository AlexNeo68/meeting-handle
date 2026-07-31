'use client';

import { Card, Spinner } from '@heroui/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function HomePage() {
  const { token } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch('/api/meetings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Ошибка загрузки встреч');
        }

        setMeetings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMeetings();
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="current" size="lg" />
        <span className="ml-3 text-muted">Загрузка встреч...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Мои встречи</h1>

      {meetings.length === 0 ? (
        <Card className="px-6 py-10 text-center">
          <p className="text-muted">Нет встреч. Создайте первую встречу, чтобы начать.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <Card.Content className="flex items-start justify-between">
                <div>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="text-base font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {meeting.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">{formatDate(meeting.date)}</p>
                </div>
                {meeting.participants.length > 0 && (
                  <span className="text-xs text-muted">{meeting.participants.join(', ')}</span>
                )}
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
