import type { User } from '../types/domain';

export function profileString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function profileStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : [];
}

/** API types do not validate existing cloud records. Normalize a display/edit copy only. */
export function profileForView(value: unknown): User {
  const user = value && typeof value === 'object' && !Array.isArray(value) ? (value as User) : {};
  return {
    userId: profileString(user.userId),
    _id: profileString(user._id),
    nickName: profileString(user.nickName),
    avatarUrl: profileString(user.avatarUrl),
    avatarFileID: profileString(user.avatarFileID),
    avatarBase64: profileString(user.avatarBase64),
    bio: profileString(user.bio),
    steamFriendCode: profileString(user.steamFriendCode),
    wechatId: profileString(user.wechatId),
    groupIds: profileStringList(user.groupIds),
    favoriteGames: profileStringList(user.favoriteGames),
    playTimes: profileStringList(user.playTimes),
  };
}
