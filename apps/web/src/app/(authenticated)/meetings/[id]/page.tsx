'use client';

import { Button, Card, Spinner } from '@heroui/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import FileList from '@/components/file-upload/file-list';
import FileUpload, { type FileUploadHandle } from '@/components/file-upload/file-upload';
import { formatDate } from '@/lib/format-date';

interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const meetingId = params.id;
  const router = useRouter();
  const { token } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filesVersion, setFilesVersion] = useState(0);
  const uploadRef = useRef<FileUploadHandle>(null);

  useEffect(() => {
    async function fetchMeeting() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Ошибка загрузки встречи');
        }

        setMeeting(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMeeting();
  }, [meetingId, token]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="current" size="lg" />
        <span className="ml-3 text-muted">Загрузка встречи...</span>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <Card.Content className="px-6 py-10 text-center">
            <h1 className="text-2xl font-semibold">Встреча не найдена</h1>
            <p className="mt-2 text-sm text-muted">
              Возможно, она была удалена или у вас нет доступа к ней.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Вернуться к списку встреч
            </Link>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
        <Button className="mt-6 min-h-11" variant="secondary" onPress={() => router.push('/')}>
          Назад
        </Button>
      </div>
    );
  }

  if (!meeting) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        ← Назад к встречам
      </Link>

      <Card className="mt-4">
        <Card.Content className="gap-2">
          <h1 className="text-2xl font-semibold">{meeting.title}</h1>
          <p className="text-sm text-muted">{formatDate(meeting.date)}</p>
          {meeting.participants.length > 0 && (
            <div className="mt-2">
              <h2 className="text-sm font-medium">Участники</h2>
              <ul className="mt-1 flex flex-wrap gap-2" role="list" aria-label="Участники встречи">
                {meeting.participants.map((participant) => (
                  <li
                    key={participant}
                    className="rounded-full border border-divider px-3 py-1 text-xs text-muted"
                  >
                    {participant}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card.Content>
      </Card>

      <section aria-label="Файлы встречи" className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Файлы</h2>
        <FileUpload
          ref={uploadRef}
          meetingId={meetingId}
          onUploaded={() => setFilesVersion((version) => version + 1)}
        />
        <div className="mt-6">
          <FileList
            meetingId={meetingId}
            refreshToken={filesVersion}
            onRequestUpload={() => uploadRef.current?.openDialog()}
          />
        </div>
      </section>
    </div>
  );
}
