<script setup lang="ts">
import { pageThemeBackground, pageThemeStyle, pageThemeForeground } from '../../utils/app-theme';
defineOptions({ name: 'HelpPage' });
import { platform } from '../../platform/host';
import { usePageFeedback } from '../../composables/usePageFeedback';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
const { dialog, toast } = usePageFeedback();
const questions = [
  [
    '加入后怎么进游戏？',
    '加入队伍后，在座位图点头像查看队友的公开资料。如果对方填写了好友码或微信号，可以用它联系对方。请在游戏里自行汇合。',
  ],
  [
    '满员、退出和结束有什么区别？',
    '满员时不能加入；有人退出且队伍未结束，就会重新招募。车头解散或到达结束时间后，不能继续加入。',
  ],
  [
    '可以同时加入多个队伍吗？',
    '可以。时间重叠时会提示，你仍可选择继续加入。请合理安排时间，不能参加时提前退出。',
  ],
  [
    '为什么没有收到提醒？',
    '微信提醒需要你主动授权，并受订阅额度与实际发送结果影响。开始前 10 分钟内才加入可能赶不上提醒，请自行留意开局时间。QQ 暂不支持微信订阅提醒。',
  ],
];
function contact() {
  void dialog
    .confirm({ title: '联系作者', msg: '作者微信号：Louisville_k', confirmButtonText: '复制微信号' })
    .then(() =>
      platform.setClipboardData({ data: 'Louisville_k', fail: () => toast.show('复制失败，请重试') }),
    )
    .catch(() => {});
}
</script>
<template>
  <page-meta :page-style="pageThemeStyle" :background-color="pageThemeBackground">
    <navigation-bar :front-color="pageThemeForeground" :background-color="pageThemeBackground" />
  </page-meta>
  <app-shell>
    <view v-for="[question, answer] in questions" :key="question" class="panel"
      ><view class="text-base font-semibold mb-2">{{ question }}</view
      ><view class="text-sm text-secondary leading-6">{{ answer }}</view></view
    >
    <wd-cell-group border>
      <wd-cell title="联系作者" prefix-icon="message" is-link @click="contact" />
    </wd-cell-group>
  </app-shell>
</template>
