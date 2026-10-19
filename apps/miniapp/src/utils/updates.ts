import { platform } from '../platform/host';
import { useAppStore } from '../stores/app';

// Add new announcements at the top. Keep an announcement's id stable after release.
export const UPDATES = [
  {
    id: '2026-10-19-card-reactions',
    date: '2026-10-19',
    title: '卡片可以直接送表情了',
    items: [
      {
        title: '在队伍卡片上直接送表情',
        description: '大厅、游戏专区和「我的」都能直接点表情。每人每队一个，再点取消，也可以换一个。',
      },
      {
        title: '发车和查看队伍更顺畅',
        description: '修复部分情况下发车成功后仍报错、队伍详情无法正常展示的问题。',
      },
    ],
  },
] as const;
export const LATEST_UPDATE = UPDATES[0];
const readInSession = new WeakMap<object, Set<string>>();
export function hasReadUpdate(id: string): boolean {
  if (readInSession.get(useAppStore())?.has(id)) return true;
  try {
    return !!platform.getStorageSync('update-notice:' + id);
  } catch {
    return false;
  }
}
export function markUpdateRead(id: string) {
  const store = useAppStore();
  const ids = readInSession.get(store) || new Set<string>();
  ids.add(id);
  readInSession.set(store, ids);
  try {
    platform.setStorageSync('update-notice:' + id, 1);
  } catch {
    // An unavailable cache must not show the same announcement again this session.
  }
}
