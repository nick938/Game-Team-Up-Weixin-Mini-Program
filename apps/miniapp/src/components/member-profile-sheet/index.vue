<script setup lang="ts">
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { appThemeStyle, component } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'MemberProfileSheet' });
import type { User } from '../../types/domain';
const props = defineProps<{ show: boolean; loading: boolean; user: User | null; error: string }>();
const { afterLeave } = useTabBarOverlay(() => props.show, { waitForAfterLeave: true });
const emit = defineEmits<{ close: []; retry: [] }>();
</script>
<template>
  <wd-popup
    :duration="component.sheet.duration"
    @after-leave="afterLeave"
    root-portal
    :z-index="1100"
    :model-value="show"
    position="bottom"
    round
    safe-area-inset-bottom
    closable
    @update:model-value="!$event && emit('close')"
    ><view class="sheet-content" :style="appThemeStyle"
      ><view class="section-title mb-5">公开资料</view><wd-loading v-if="loading" /><view
        v-else-if="error"
        class="text-center"
        ><wd-empty :tip="error" /><wd-button variant="soft" @click="emit('retry')">重新加载</wd-button></view
      ><view v-else-if="user"
        ><view class="flex items-center gap-4"
          ><image
            class="avatar"
            :src="
              user.avatarUrl ||
              (user.avatarBase64
                ? 'data:image/jpeg;base64,' + user.avatarBase64
                : '/static/images/avatar.png')
            "
            mode="aspectFill"
          /><view class="section-title">{{ user.nickName || '玩家' }}</view></view
        ><view class="mt-5 text-sm whitespace-pre-wrap break-words leading-7">{{
          user.bio || '这位队友还没有填写签名'
        }}</view></view
      ></view
    ></wd-popup
  >
</template>
