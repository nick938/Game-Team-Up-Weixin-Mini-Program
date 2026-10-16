<script setup lang="ts">
defineOptions({ name: 'TimelinePreview' });
</script>
<template>
  <app-shell title="找队友，开一局" subtitle="好玩的局，就差一个你。"
    ><view class="panel text-center"
      ><image class="w-full h-48" src="/static/images/brand/lobby-v1.jpg" mode="aspectFit" /><wd-tag
        type="primary"
        >开黑星球</wd-tag
      ><view class="text-sm leading-7 mt-5">和游戏好友约好时间，一起组队开黑。</view
      ><wd-notice-bar
        text="点击底部「前往小程序」查看最新队伍"
        :scrollable="false"
        custom-class="!mt-5"
      /><view class="hint mt-4">发车或加入好友的队伍</view></view
    ></app-shell
  >
</template>
