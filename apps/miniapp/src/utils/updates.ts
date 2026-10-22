import { platform } from '../platform/host';
import { useAppStore } from '../stores/app';
import { APP_VERSION } from './constants';

// Add new announcements at the top. Keep an announcement's id stable after release.
export const UPDATES = [
  {
    id: '2026-10-19-card-reactions',
    date: '2026-10-19',
    title: '大厅更清爽，卡片互动更方便',
    items: [
      {
        title: '卡片更紧凑，找队伍更方便',
        description: '合并人数、时间和车头信息，减少卡片高度；常用游戏直接筛选，其他游戏在「更多」中搜索。',
      },
      {
        title: '在队伍卡片上直接互动',
        description: '大厅、游戏专区和「我的」都能直接点图标互动。每人每队一个，再点取消，也可以换一个。',
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
  const key = APP_VERSION + ':' + id;
  if (readInSession.get(useAppStore())?.has(key)) return true;
  try {
    return !!platform.getStorageSync('update-notice:' + key);
  } catch {
    return false;
  }
}
export function markUpdateRead(id: string) {
  const key = APP_VERSION + ':' + id;
  const store = useAppStore();
  const ids = readInSession.get(store) || new Set<string>();
  ids.add(key);
  readInSession.set(store, ids);
  try {
    platform.setStorageSync('update-notice:' + key, 1);
  } catch {
    // An unavailable cache must not show the same announcement again this session.
  }
}
