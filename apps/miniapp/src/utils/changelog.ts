// New versions go first. Keep published records when adding the next version.
export const CHANGELOG = [
  {
    version: '1.8.4',
    date: '2026-10-19',
    sections: [
      {
        title: '新增',
        items: [
          '大厅、游戏专区和「我的」队伍卡片支持直接送表情，可切换或再次点击取消。',
          '更新公告独立于首次欢迎提示，更新后通知一次，也可在「我的」和「帮助与反馈」中查看。',
          '新增更新日志，按版本保留功能变化和问题修复记录。',
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
] as const;
