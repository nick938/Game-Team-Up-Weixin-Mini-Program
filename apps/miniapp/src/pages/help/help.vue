<script setup lang="ts">
defineOptions({ name: 'HelpPage' });
import { platform } from '../../platform/host';
import { usePageFeedback } from '../../composables/usePageFeedback';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
const { dialog, toast } = usePageFeedback();
const questions = [
  [
    '加入后怎么进游戏？',
    '加入队伍后，复制详情里的房间号或好友码，再打开游戏加入。小程序只记录组队位置，不会自动进入游戏。',
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
  ['密码谁能看到？', '加入方式公开；密码仅按成员权限展示。车头可以查看，队员在未解散时可查看。'],
];
function open(path: string) {
  platform.navigateTo({ url: '/pages/' + path });
}
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
  <app-shell title="帮助与反馈" subtitle="先看看常见问题，也欢迎告诉我们哪里需要改进。">
    <view v-for="[question, answer] in questions" :key="question" class="panel"
      ><view class="text-base font-semibold mb-2">{{ question }}</view
      ><view class="text-sm text-secondary leading-6">{{ answer }}</view></view
    >
    <wd-cell-group
      ><wd-cell title="更新公告" is-link @click="open('updates/updates')" /><wd-cell
        title="意见反馈"
        label="功能建议与体验反馈"
        is-link
        @click="open('feedback/feedback')" /><wd-cell
        title="报个错"
        label="页面异常或功能无法使用"
        is-link
        @click="open('bug/bug')" /><wd-cell title="联系作者" is-link @click="contact" /><wd-cell
        title="用户协议"
        is-link
        @click="open('legal/legal?type=agreement')" /><wd-cell
        title="隐私政策"
        is-link
        @click="open('legal/legal?type=privacy')" /><wd-cell
        title="社区公约"
        is-link
        @click="open('legal/legal?type=community')"
    /></wd-cell-group>
  </app-shell>
</template>
