// Adapted from unibest base; see README.md for template provenance.
import { semantic } from './src/design/tokens.ts';
import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages';
export default defineUniPages({
  pages: [
    {
      path: 'pages/index/index',
      style: {
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
      path: 'pages/publish/publish',
      style: {
        navigationBarTitleText: '发起组队开黑',
      },
    },
    {
      path: 'pages/mine/mine',
      style: {
        navigationBarTitleText: '我的',
        enablePullDownRefresh: true,
      },
    },
    {
      path: 'pages/team/detail',
      style: {
        navigationBarTitleText: '组队详情',
        enablePullDownRefresh: true,
      },
    },
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
        backgroundTextStyle: 'light',
      },
    },
    {
      path: 'pages/probe/index',
      style: {
        navigationBarTitleText: '接入诊断',
      },
    },
  ],
  globalStyle: {
    backgroundColor: semantic.color.page,
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: semantic.color.page,
    navigationBarTitleText: '开黑星球｜游戏搭子',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: semantic.color.muted,
    selectedColor: semantic.color.brand,
    backgroundColor: semantic.color.surface,
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '大厅',
        iconPath: 'static/images/fresh-plaza.png',
        selectedIconPath: 'static/images/fresh-plaza-active.png',
      },
      {
        pagePath: 'pages/publish/publish',
        text: '发车',
        iconPath: 'static/images/fresh-plus.png',
        selectedIconPath: 'static/images/fresh-plus-active.png',
      },
      {
        pagePath: 'pages/mine/mine',
        text: '我的',
        iconPath: 'static/images/fresh-user.png',
        selectedIconPath: 'static/images/fresh-user-active.png',
      },
    ],
  },
  easycom: {
    autoscan: true,
    custom: {
      '^wd-(.*)': '@wot-ui/ui/components/wd-$1/wd-$1.vue',
      '^team-manage-sheet$': '@/components/team-manage-sheet/index.vue',
      '^member-profile-sheet$': '@/components/member-profile-sheet/index.vue',
      '^admin-overview$': '@/components/admin-overview/index.vue',
      '^app-(input|textarea|picker|datetime-picker)$': '@/components/app-$1/index.vue',
      '^app-avatar$': '@/components/app-avatar/index.vue',
      '^app-shell$': '@/components/app-shell/index.vue',
      '^team-card$': '@/components/team-card/index.vue',
      '^lobby-hero$': '@/components/lobby-hero/index.vue',
      '^profile-gate$': '@/components/profile-gate/index.vue',
      '^welcome-letter$': '@/components/welcome-letter/index.vue',
      '^timeline-preview$': '@/components/timeline-preview/index.vue',
    },
  },
});
