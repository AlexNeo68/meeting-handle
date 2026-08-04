'use client';

import { Card, Skeleton } from '@heroui/react';
import { useAuth } from '@/contexts/auth-context';
import AvatarSection from '@/components/profile/avatar-section';
import GeneralSection from '@/components/profile/general-section';
import PasswordSection from '@/components/profile/password-section';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 flex flex-col gap-6">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Профиль</h1>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <Card.Header>
            <Card.Title>Аватар</Card.Title>
            <Card.Description>Фото, по которому вас узнают коллеги</Card.Description>
          </Card.Header>
          <Card.Content>
            <AvatarSection />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Основное</Card.Title>
            <Card.Description>Имя и email</Card.Description>
          </Card.Header>
          <Card.Content className="w-full">
            <GeneralSection />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Пароль</Card.Title>
            <Card.Description>Смена пароля от аккаунта</Card.Description>
          </Card.Header>
          <Card.Content className="w-full">
            <PasswordSection />
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
