// 小程序内更新日志：新版本放在首位，保留历史记录。
// title 与 highlights 是更新公告弹窗的文案；sections 是「更新日志」页按类型分组的详细记录。
// 公告弹窗与更新日志页共用这一份数据，发版时只改这里和仓库 CHANGELOG.md。
export interface ChangelogHighlight {
  title: string;
  description: string;
}

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  title: string;
  highlights: ChangelogHighlight[];
  sections: ChangelogSection[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '1.8.4',
    date: '2026-10-19',
    title: '大厅更清爽，卡片互动更方便',
    highlights: [
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
    sections: [
      {
        title: '优化',
        items: [
          '队伍卡片合并人数、时间和车头信息，减少高度，保留卡片直接互动。',
          '搜索收进筛选右侧的图标入口，点击后展开紧凑输入框。',
          '互动图标支持浅色与深色选中切换，点击后立即更新图标和计数，请求失败自动回退，首屏卡片短暂淡入，支持减少动态效果。',
          '大厅保留常用游戏筛选，其他游戏可在「更多」中搜索选择。',
        ],
      },
      {
        title: '新增',
        items: [
          '大厅、游戏专区和「我的」队伍卡片支持直接点击图标互动，可切换或再次点击取消。',
          '新版本首次进入时弹出更新公告，按发布版本记录本机已读状态，确认后不重复；「我的」和「帮助与反馈」提供统一的更新日志入口。',
          '更新日志按版本记录功能变化与问题修复，公告与日志共用同一份版本数据。',
        ],
      },
      {
        title: '修复',
        items: [
          '修复部分情况下队伍已发布成功，却仍提示报错、未跳转详情的问题。',
          '修复记录最近游戏异常时，队伍详情或游戏专区无法正常打开的问题。',
          '从公告跳转页面前等待弹窗关闭，避免底部导航未恢复。',
        ],
      },
    ],
  },
];
