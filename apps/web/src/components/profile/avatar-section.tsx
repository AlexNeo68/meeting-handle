'use client';

import { ALLOWED_AVATAR_MIME_TYPES, AVATAR_ACCEPT_ATTR, MAX_AVATAR_SIZE } from '@meeting-ai/shared';
import { Button, toast } from '@heroui/react';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import UserAvatar from '../user-avatar';

export default function AvatarSection() {
  const { token, user, updateUser, bumpAvatarVersion } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = useCallback(() => {
    if (isUploading) return;
    inputRef.current?.click();
  }, [isUploading]);

  const uploadAvatar = useCallback(
    (file: File) => {
      if (!token) return;

      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      fetch('/api/user/profile/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;

          if (!res.ok) {
            const message = data?.message || 'Не удалось загрузить аватар';
            setError(message);
            toast.danger(message);
            return;
          }

          updateUser({ hasAvatar: true });
          bumpAvatarVersion();
          toast.success('Аватар обновлён');
        })
        .catch(() => {
          setError('Ошибка сети. Попробуйте ещё раз.');
          toast.danger('Ошибка сети. Попробуйте ещё раз.');
        })
        .finally(() => {
          setIsUploading(false);
        });
    },
    [token, updateUser, bumpAvatarVersion],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || isUploading) return;

      setError(null);

      if (file.size > MAX_AVATAR_SIZE) {
        setError('Файл слишком большой. Максимальный размер — 5 МБ.');
        return;
      }

      if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
        setError('Неподдерживаемый формат изображения.');
        return;
      }

      uploadAvatar(file);
    },
    [isUploading, uploadAvatar],
  );

  const removeAvatar = useCallback(() => {
    if (!token || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    fetch('/api/user/profile/avatar', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;

        if (!res.ok) {
          const message = data?.message || 'Не удалось удалить аватар';
          setError(message);
          toast.danger(message);
          return;
        }

        updateUser({ hasAvatar: false });
        bumpAvatarVersion();
        toast.success('Аватар удалён');
      })
      .catch(() => {
        setError('Ошибка сети. Попробуйте ещё раз.');
        toast.danger('Ошибка сети. Попробуйте ещё раз.');
      })
      .finally(() => {
        setIsDeleting(false);
      });
  }, [token, isDeleting, updateUser, bumpAvatarVersion]);

  return (
    <div className="flex items-center gap-6">
      <UserAvatar size={96} isUploading={isUploading || isDeleting} />

      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            isDisabled={isUploading || isDeleting}
            isPending={isUploading}
            onPress={openDialog}
            aria-describedby={error ? 'avatar-section-error' : undefined}
          >
            {({ isPending }) => (isPending ? 'Загрузка...' : 'Загрузить аватар')}
          </Button>

          <Button
            aria-label="Удалить аватар"
            className="min-h-11"
            variant="tertiary"
            isDisabled={isUploading || isDeleting || !user?.hasAvatar}
            isPending={isDeleting}
            onPress={removeAvatar}
            aria-describedby={error ? 'avatar-section-error' : undefined}
          >
            {({ isPending }) => (isPending ? 'Удаление...' : 'Удалить')}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT_ATTR}
          onChange={handleChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        {error && (
          <p
            id="avatar-section-error"
            role="alert"
            aria-live="polite"
            className="text-sm text-danger"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
