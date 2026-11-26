// Adapted from unibest base; see README.md for template provenance.
import { semantic } from './src/design/tokens.ts';
import { tabBarItems } from './src/design/tab-bar.ts';
import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages';
const themed = ['mp-weixin', 'h5'].includes(process.env.UNI_PLATFORM || '');
const pageBackground = themed ? '@pageBackground' : semantic.color.page;
const navigationText = (themed ? '@navigationText' : 'black') as 'black';
const refreshText = (themed ? '@refreshText' : 'light') as 'light';
export default defineUniPages({
  pages: [
    ...(process.env.UNI_PLATFORM === 'mp-weixin'
      ? []
      : [
          {
            path: 'pages/play/play',
            style: {
              navigationStyle: 'custom' as const,
              navigationBarTitleText: '今天玩啥',
              enablePullDownRefresh: true,
            },
          },
        ]),
    {
      path: 'pages/friday/friday',
      style: { navigationStyle: 'custom', navigationBarTitleText: '用户排行', enablePullDownRefresh: true },
    },
    {
      path: 'pages/index/index',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '开黑星球｜游戏搭子',
        enablePullDownRefresh: true,
      },
    },
    {
      path: 'pages/game/game',
      style: {
        navigationBarTitleText: '开黑星球｜游戏搭子',
        enablePullDownRefresh: true,
      },
    },
    {
      path: 'pages/publish/claim',
      style: { navigationBarTitleText: '接手官方车' },
    },
    {
      path: 'pages/publish/publish',
      style: {
        navigationStyle: 'custom',
        navigationBarTextStyle: navigationText,
        navigationBarTitleText: '发起组队开黑',
      },
    },
    {
      path: 'pages/mine/mine',
      style: {
        navigationStyle: 'custom',
        navigationBarTextStyle: 'white',
        navigationBarBackgroundColor: '#211B3B',
        backgroundColor: pageBackground,
        navigationBarTitleText: '我的',
        enablePullDownRefresh: true,
      },
    },
    { path: 'pages/mine/teams', style: { navigationBarTitleText: '我的队伍', enablePullDownRefresh: true } },
    { path: 'pages/mine/settings', style: { navigationBarTitleText: '设置中心' } },
    {
      path: 'pages/team/detail',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '组队详情',
        enablePullDownRefresh: true,
      },
    },
    { path: 'pages/help/help', style: { navigationBarTitleText: '常见问题' } },
    { path: 'pages/updates/updates', style: { navigationBarTitleText: '更新公告' } },
    { path: 'pages/changelog/changelog', style: { navigationBarTitleText: '更新日志' } },
    {
      path: 'pages/legal/legal',
      style: {
        navigationBarTitleText: '开黑星球',
      },
    },
    {
      path: 'pages/feedback/feedback',
      style: {
        navigationBarTitleText: '意见反馈',
      },
    },
    {
      path: 'pages/bug/bug',
      style: {
        navigationBarTitleText: '报个错',
      },
    },
    {
      path: 'pages/report/report',
      style: {
        navigationBarTitleText: '举报',
      },
    },
    {
      path: 'pages/admin/admin',
      style: {
        navigationBarTitleText: '管理端',
        enablePullDownRefresh: true,
        backgroundTextStyle: refreshText,
      },
    },
  ],
  globalStyle: {
    backgroundColor: pageBackground,
    backgroundTextStyle: refreshText,
    navigationBarBackgroundColor: pageBackground,
    navigationBarTitleText: '开黑星球｜游戏搭子',
    navigationBarTextStyle: navigationText,
  },
  tabBar: {
    custom: process.env.UNI_PLATFORM === 'mp-weixin',
    color: themed ? '@tabText' : semantic.color.muted,
    selectedColor: themed ? '@tabSelected' : semantic.color.brand,
    backgroundColor: themed ? '@tabBackground' : semantic.color.surface,
    borderStyle: (themed ? '@tabBorder' : 'white') as 'white',
    list: tabBarItems,
  },
  easycom: {
    autoscan: true,
    custom: {
      '^wd-(.*)': '@wot-ui/ui/components/wd-$1/wd-$1.vue',
      '^team-manage-sheet$': '@/components/team-manage-sheet/index.vue',
      '^member-profile-sheet$': '@/components/member-profile-sheet/index.vue',
      '^admin-overview$': '@/components/admin-overview/index.vue',
      '^app-(input|textarea|picker|datetime-picker|multi-select)$': '@/components/app-$1/index.vue',
      '^app-shell$': '@/components/app-shell/index.vue',
      '^page-navigation$': '@/components/page-navigation/index.vue',
      '^team-card$': '@/components/team-card/index.vue',
      '^profile-tags$': '@/components/profile-tags/index.vue',
      '^profile-gate$': '@/components/profile-gate/index.vue',
      '^welcome-letter$': '@/components/welcome-letter/index.vue',
      '^entry-notices$': '@/components/entry-notices/index.vue',
      '^timeline-preview$': '@/components/timeline-preview/index.vue',
    },
  },
});
