<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/publish/publish');
import { reactive, ref } from 'vue';
import { onShow, onResize, onPageScroll } from '@dcloudio/uni-app';
import { homeNavigationMetrics, type CapsuleRect } from '../../utils/home-navigation';
import type { FormSchema } from '@wot-ui/ui';
import type { FormExpose } from '@wot-ui/ui/components/wd-form/types';
import { useAppTheme } from '../../composables/useAppTheme';
import { usePublish } from '../../composables/usePublish';
import AppActionDock from '../../components/app-action-dock/index.vue';
defineOptions({ name: 'PublishPublishPage' });
useAppTheme();
const page = reactive(usePublish());
const form = ref<FormExpose>();
const navigation = ref(homeNavigationMetrics());
const scrolled = ref(false);
function updateNavigation() {
  const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
  let capsule: CapsuleRect | undefined;
  // #ifdef MP-WEIXIN || MP-QQ
  if (uni.getMenuButtonBoundingClientRect) capsule = uni.getMenuButtonBoundingClientRect();
  // #endif
  navigation.value = homeNavigationMetrics(info.statusBarHeight, info.windowWidth, capsule);
}
onShow(updateNavigation);
onResize(updateNavigation);
onPageScroll(({ scrollTop }) => {
  scrolled.value = scrollTop > 24;
});
const schema: FormSchema = {
  isRequired: (path) => ['gameName', 'roomNo'].includes(path),
  validate: (model) =>
    ['gameName', 'roomNo']
      .filter((key) => !String(model[key] || '').trim())
      .map((key) => ({
        path: [key],
        message: key === 'gameName' ? '请选择或输入游戏' : '请填写车头的好友码或联系方式',
      })),
};
function errorFor(anchor: string) {
  return page.state.validationError?.anchor === anchor ? page.state.validationError.message : '';
}
async function submit() {
  if ((await form.value?.validate())?.valid === false) return;
  await page.onSubmit();
}
</script>
<template>
  <view class="publish-page" :style="{ '--publish-nav-height': navigation.total + 'px' }">
    <view
      class="publish-navigation"
      :class="{ 'publish-navigation-scrolled': scrolled }"
      :style="{ paddingTop: navigation.status + 'px' }"
    >
      <view
        class="publish-navigation-title"
        :style="{
          height: navigation.height + 'px',
          paddingLeft: navigation.right + 'px',
          paddingRight: navigation.right + 'px',
        }"
        >发起组队开黑</view
      >
    </view>
    <view class="publish-navigation-spacer" />
    <timeline-preview v-if="page.singlePage" />
    <app-shell
      :active="pageActive"
      v-else
      variant="form"
      :title="page.editingId ? '调整这局' : page.proxyMode ? '帮朋友开一局' : '发个车，找人一起玩'"
    >
      <view v-if="page.editingId" class="form-note"
        ><text>正在编辑已有队伍</text
        ><wd-button size="small" variant="text" @click="page.startNew">改为新建</wd-button></view
      >
      <view v-if="page.state.weeklyId" class="form-note"
        >已带入周五 21:00 的活动游戏和时间。修改游戏或开局时间后，将作为普通队伍发布。</view
      >
      <wd-form ref="form" :model="page.state" :schema="schema" title-width="84px" center border>
        <view class="form-section">
          <view id="field-game">
            <app-input
              prop="gameName"
              label="玩什么"
              :model-value="page.gameName"
              :maxlength="40"
              clearable
              required
              hide-asterisk
              placeholder="输入游戏名"
              :error="errorFor('field-game')"
              @update:model-value="page.onGameName(String($event))"
            />
          </view>
          <scroll-view
            v-if="page.state.recentLaunches.length && !page.editingId"
            class="game-shortcuts"
            scroll-x
          >
            <view class="history-row">
              <text class="history-label">最近发过</text>
              <wd-tag
                v-for="team in page.state.recentLaunches"
                :key="team._id"
                size="small"
                :variant="page.state.selectedHistoryId === team._id ? 'light' : 'text'"
                type="primary"
                round
                @click="page.reuseLaunch(team)"
                >{{ team.gameName }}</wd-tag
              >
            </view>
          </scroll-view>
        </view>
        <view class="form-section">
          <view id="field-start">
            <app-datetime-picker
              label="开始时间"
              type="datetime"
              :model-value="page.startTimestamp"
              :min-date="page.minTimestamp"
              :max-date="page.maxTimestamp"
              @confirm="page.changeStart(Number($event.value))"
            />
          </view>
          <view v-if="errorFor('field-start')" class="field-error px-4">{{ errorFor('field-start') }}</view>
          <wd-cell id="field-end" title="玩多久（小时）" title-width="112px" center value-align="right">
            <view class="number-input">
              <wd-input-number
                :model-value="page.state.durationMinutes / 60"
                :min="0.5"
                :max="24"
                :step="0.5"
                :precision="1"
                step-strictly
                :immediate-change="false"
                @update:model-value="page.changeDuration(Number($event) * 60)"
              />
            </view>
          </wd-cell>
        </view>
        <view class="form-section">
          <wd-cell id="field-capacity" title="本车几位" title-width="112px" center value-align="right">
            <view class="number-input">
              <wd-input-number
                v-model="page.capacity"
                disable-input
                :min="page.state.minimumCapacity"
                :max="20"
              />
            </view>
          </wd-cell>
        </view>
        <view v-if="errorFor('field-end') || errorFor('field-capacity')" class="field-error mb-3">{{
          errorFor('field-end') || errorFor('field-capacity')
        }}</view>
        <view v-if="page.canProxy && !page.editingId" class="form-section"
          ><wd-cell title="帮朋友发车" label="由对方担任车头"
            ><wd-switch :model-value="page.proxyMode" @update:model-value="page.toggleProxy(Boolean($event))"
          /></wd-cell>
          <view v-if="page.proxyMode" id="field-proxy">
            <wd-cell
              v-if="page.proxyHost"
              :title="page.proxyHost.nickName"
              value="换一个"
              is-link
              @click="page.clearProxyHost"
            />
            <template v-else
              ><wd-search
                :model-value="page.proxyKeyword"
                hide-cancel
                placeholder="搜索朋友在小程序里的昵称"
                @update:model-value="page.onProxyKeyword(String($event))"
              /><wd-loading v-if="page.proxySearching" /><wd-cell
                v-for="user in page.proxyResults"
                :key="user.userId"
                :title="user.nickName"
                is-link
                @click="page.pickProxyHost(user)"
              /><view
                v-if="page.proxyKeyword && !page.proxySearching && !page.proxyResults.length"
                class="form-note px-4"
                >没找到，对方需先设置昵称</view
              ></template
            >
            <view v-if="errorFor('field-proxy')" class="field-error px-4 mb-3">{{
              errorFor('field-proxy')
            }}</view>
          </view>
        </view>
        <view class="form-section">
          <view id="field-room">
            <app-input
              prop="roomNo"
              label="联系车头"
              layout="horizontal"
              :model-value="page.roomNo"
              :maxlength="80"
              clearable
              required
              hide-asterisk
              placeholder="必填：好友码 / 游戏 ID / 微信号"
              :error="errorFor('field-room')"
              @update:model-value="page.onRoomNo(String($event))"
            />
          </view>
          <app-input
            label="房间密码"
            :model-value="page.roomPwd"
            :maxlength="32"
            placeholder="选填，仅队伍成员可见"
            @update:model-value="page.onRoomPwd(String($event))"
          />
        </view>
        <view class="form-section">
          <app-picker
            label="语音"
            :model-value="page.voice"
            :columns="page.voices"
            @confirm="page.pickVoice(String($event.value))"
          />
        </view>
        <view class="form-section">
          <app-textarea
            label="备注"
            :model-value="page.note"
            :maxlength="500"
            auto-height
            placeholder="选填：区服、房间号、KOOK 房间地址、玩法或队友要求"
            @update:model-value="page.onNote(String($event))"
          />
        </view>
      </wd-form>
      <view v-if="page.state.editLoadError" class="panel"
        ><view class="field-error">{{ page.state.editLoadError }}</view
        ><wd-button variant="text" @click="page.loadEdit(page.editingId)">重新加载</wd-button></view
      >
      <view class="publish-dock-spacer" />
      <view v-if="pageActive" class="publish-dock">
        <app-action-dock :active="pageActive">
          <wd-button
            block
            :loading="page.submitting"
            :disabled="page.submitting || !!page.state.editLoadError"
            @click="submit"
            >{{ page.editingId ? '保存修改' : page.proxyMode && page.proxyHost ? '帮 TA 发布' : '发车'
            }}<wd-icon name="arrow-right" size="16px" custom-class="!ml-2" /></wd-button
        ></app-action-dock>
      </view>
      <profile-gate
        :show="page.showProfile"
        @done="page.onProfileDone"
        @close="page.onProfileClose"
      /><entry-notices />
    </app-shell>
  </view>
</template>

<style scoped>
.publish-navigation {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  color: #22232a;
  background: rgba(244, 245, 248, 0.94);
  transition:
    background-color 180ms ease,
    box-shadow 180ms ease;
}
.publish-navigation-scrolled {
  background: rgba(247, 246, 253, 0.98);
  box-shadow: 0 1px 0 rgba(98, 85, 231, 0.06);
}
.publish-navigation-title {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  max-width: 560px;
  margin: 0 auto;
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
  white-space: nowrap;
}
.publish-navigation-spacer {
  height: var(--publish-nav-height);
}
.publish-page :deep(.page-form) {
  min-height: calc(100vh - var(--publish-nav-height));
}
@media (prefers-reduced-motion: reduce) {
  .publish-navigation {
    transition: none;
  }
}

.number-input {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
}
.game-shortcuts {
  width: 100%;
}
.history-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  padding: 2px 12px 10px;
}
.history-row :deep(.wd-tag) {
  flex-shrink: 0;
  white-space: nowrap;
}
.history-label {
  color: #9295a5;
  font-size: 11px;
  white-space: nowrap;
}
.publish-dock-spacer {
  height: 86px;
}
.publish-dock {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--window-bottom, 0px) + 8px);
  max-width: 568px;
  margin: 0 auto;
  z-index: 30;
}
</style>
