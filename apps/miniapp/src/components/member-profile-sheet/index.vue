<script setup lang="ts">
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import { appThemeStyle, component } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'MemberProfileSheet' });
import { useImagePreview } from '@wot-ui/ui';
import { useProfileContacts } from '../../composables/useProfileContacts';
import type { User } from '../../types/domain';
const props = defineProps<{ show: boolean; loading: boolean; user: User | null; error: string }>();
const { contacts, copyContact } = useProfileContacts(() => props.user);
const { afterLeave } = useTabBarOverlay(() => props.show, { waitForAfterLeave: true });
const emit = defineEmits<{ close: []; retry: [] }>();
const { previewImage } = useImagePreview();
function previewAvatar() {
  const src = props.user && props.user.avatarUrl;
  if (src) previewImage([src]);
}
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
      ><scroll-view v-else-if="user" scroll-y class="member-profile-content"
        ><view class="flex items-center gap-4"
          ><view
            class="shrink-0"
            role="button"
            :aria-label="'查看' + (user.nickName || '玩家') + '的头像'"
            @click="previewAvatar"
            ><wd-avatar
              size="medium"
              shape="square"
              mode="aspectFill"
              :src="user.avatarUrl || '/static/images/avatar.png'" /></view
          ><view class="section-title">{{ user.nickName || '玩家' }}</view></view
        ><view class="mt-5 text-sm whitespace-pre-wrap break-words leading-7">{{
          user.bio || '这位队友还没有填写签名'
        }}</view
        ><profile-tags :user="user" />
        <view v-if="contacts.length" class="profile-contacts">
          <view class="hint mb-2">加个好友 · 点击图标或长按号码复制</view>
          <wd-cell-group border>
            <wd-cell v-for="item in contacts" :key="item.key" :title="item.label" layout="vertical">
              <view class="contact-row">
                <text class="contact-value" @longpress.stop="copyContact(item.key)">{{ item.value }}</text>
                <wd-button
                  variant="text"
                  size="small"
                  :aria-label="'复制' + item.label"
                  custom-class="contact-copy"
                  @click.stop="copyContact(item.key)"
                  ><wd-icon name="copy" size="19px"
                /></wd-button>
              </view>
            </wd-cell>
          </wd-cell-group>
        </view> </scroll-view
      ><wd-image-preview :z-index="1300" /></view
  ></wd-popup>
</template>

<style scoped>
.member-profile-content {
  max-height: 65vh;
}
.profile-contacts {
  margin-top: 20px;
}
.contact-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.contact-value {
  min-width: 0;
  flex: 1;
  text-align: left;
  overflow-wrap: anywhere;
  user-select: none;
}
.contact-copy {
  flex-shrink: 0;
}
</style>
