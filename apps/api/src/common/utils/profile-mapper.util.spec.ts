import { toProfile } from './profile-mapper.util';

describe('toProfile', () => {
  it('should map a user to profile shape with hasAvatar false when no avatar', () => {
    expect(
      toProfile({
        id: 'uuid-123',
        email: 'user@example.com',
        name: 'Alice',
        avatarStoragePath: null,
      }),
    ).toEqual({
      id: 'uuid-123',
      email: 'user@example.com',
      name: 'Alice',
      hasAvatar: false,
    });
  });

  it('should set hasAvatar true when avatarStoragePath is set', () => {
    expect(
      toProfile({
        id: 'uuid-123',
        email: 'user@example.com',
        name: null,
        avatarStoragePath: 'user-id/avatar/avatar.png',
      }),
    ).toEqual({
      id: 'uuid-123',
      email: 'user@example.com',
      name: null,
      hasAvatar: true,
    });
  });

  it('should not leak avatarStoragePath into the profile', () => {
    const result = toProfile({
      id: 'uuid-123',
      email: 'user@example.com',
      name: 'Alice',
      avatarStoragePath: 'user-id/avatar/avatar.png',
    });

    expect(result).not.toHaveProperty('avatarStoragePath');
  });
});
