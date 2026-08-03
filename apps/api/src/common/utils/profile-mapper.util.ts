export interface ProfileSource {
  id: string;
  email: string;
  name: string | null;
  avatarStoragePath: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  hasAvatar: boolean;
}

export function toProfile(user: ProfileSource): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    hasAvatar: user.avatarStoragePath !== null,
  };
}
