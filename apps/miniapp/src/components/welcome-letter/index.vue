<script setup lang="ts">
import { component } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'WelcomeLetter' });
import { reactive, toRefs, nextTick, onMounted, watch } from 'vue';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { onShow } from '@dcloudio/uni-app';

import { platform as hostPlatform } from '../../platform/host';
import { isSinglePage } from '../../utils/runtime';
import { hasReadWelcome, markWelcomeRead } from '../../utils/welcome';
const emit = defineEmits<{ ready: [] }>();
const props = withDefaults(defineProps<{ enabled?: boolean }>(), { enabled: true });
const state = reactive({
  show: false,
  closing: false,
});
const { show } = toRefs(state);
const { afterLeave: releaseOverlay } = useTabBarOverlay(show, { waitForAfterLeave: true });
let pendingNavigation = '';
function afterLeave() {
  releaseOverlay();
  if (pendingNavigation) {
    const url = pendingNavigation;
    pendingNavigation = '';
    hostPlatform.navigateTo({ url });
  } else if (!isSinglePage() && hasReadWelcome()) emit('ready');
  state.closing = false;
}
function patchState(patch: Partial<typeof state>, done?: () => void) {
  Object.assign(state, patch);
  if (done) void nextTick(done);
}
function syncVisibility() {
  if (isSinglePage() || props.enabled === false) {
    patchState({ show: false });
    return;
  }
  const read = hasReadWelcome();
  patchState({ show: !read });
  if (read && !state.closing) emit('ready');
}
function dismiss() {
  markWelcomeRead();
  patchState({ show: false, closing: true });
}
function closeAndNavigate(url: string) {
  if (state.show) {
    pendingNavigation = url;
    dismiss();
  } else hostPlatform.navigateTo({ url });
}
function openRules() {
  closeAndNavigate('/pages/legal/legal?type=community');
}
function openFeedback() {
  closeAndNavigate('/pages/feedback/feedback');
}
onMounted(() => {
  syncVisibility();
});
onShow(() => {
  syncVisibility();
});
watch(() => props.enabled, syncVisibility);
</script>
<template>
  <wd-popup
    :duration="component.sheet.duration"
    @after-leave="afterLeave"
    root-portal
    :z-index="1100"
    :model-value="show"
    :close-on-click-modal="false"
    custom-class="!w-11/12 !max-w-[320px] !rounded-3xl"
  >
    <view class="p-6 box-border bg-surface"
      ><view class="flex items-center justify-between gap-4 mb-5"
        ><view
          ><view class="brand-kicker">开黑星球｜游戏搭子</view
          ><view class="text-2xl font-bold mt-2">找一些朋友，玩一些游戏。</view></view
        ><wd-img
          custom-class="w-14 h-14 rounded-2xl surface-shadow"
          src="/static/images/brand/avatar-v1.jpg"
          mode="aspectFill"
          :radius="16"
          :show-loading="false"
          :show-error="false"
      /></view>
      <view class="text-sm leading-7"
        >嘿，欢迎上车。这里是给游戏好友发车组队用的。车上都是真人，请友好相处。</view
      ><view class="rounded-2xl bg-brand-light p-4 my-4 text-sm leading-7"
        ><view>准时来；来不了就提前下车。</view><view>说话友善，别阴阳、别骂人、别骚扰。</view
        ><view>不发外挂、代练、买卖账号，也不诱导加微信。</view
        ><view>房间号和密码只给这局里的人用。</view></view
      ><view class="hint mb-5">点下面，即表示你愿意遵守社区公约。玩得开心。</view
      ><wd-button block @click="dismiss">好的，开黑去</wd-button
      ><view class="flex justify-center gap-4 mt-3"
        ><wd-button size="small" variant="text" @click="openRules">社区公约</wd-button
        ><wd-button size="small" variant="text" @click="openFeedback">意见反馈</wd-button></view
      >
    </view>
  </wd-popup>
</template>
