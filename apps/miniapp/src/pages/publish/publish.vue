<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/publish/publish');
import { reactive, ref, watch } from 'vue';
import type { FormSchema } from '@wot-ui/ui';
import type { FormExpose } from '@wot-ui/ui/components/wd-form/types';
import { useAppTheme } from '../../composables/useAppTheme';
import { recentGames } from '../../utils/recent-games';
import { usePublish } from '../../composables/usePublish';
import { useTabBarOverlay } from '../../composables/useTabBarOverlay';
import AppActionDock from '../../components/app-action-dock/index.vue';
defineOptions({ name: 'PublishPublishPage' });
useAppTheme();
const page = reactive(usePublish());
const form = ref<FormExpose>();
const showGames = ref(false);
watch(pageActive, (value) => {
  if (!value) showGames.value = false;
});
useTabBarOverlay(showGames);
const games = ref<{ label: string; value: string }[]>([]);
watch(showGames, (visible) => {
  if (visible)
    games.value = [...new Set([...recentGames(), ...page.suggestedGames.map((game) => game.name)])].map(
      (name) => ({ label: name, value: name }),
    );
});
const starts = page.startPresets.map((item) => ({ value: item.key, payload: { label: item.label } }));
const durations = page.durationPresets.map((item) => ({ value: item.hours, payload: { label: item.label } }));
const schema: FormSchema = {
  isRequired: (path) => ['gameName', 'roomNo'].includes(path),
  validate: (model) =>
    ['gameName', 'roomNo']
      .filter((key) => !String(model[key] || '').trim())
      .map((key) => ({
        path: [key],
        message: key === 'gameName' ? '请选择或输入游戏' : '请填写房间 / 加入方式',
      })),
};
function errorFor(anchor: string) {
  return page.state.validationError?.anchor === anchor ? page.state.validationError.message : '';
}
async function submit() {
  if ((await form.value?.validate())?.valid === false) return;
  await page.onSubmit();
}
function duration(value: string | number) {
  if (Number(value) === 0) page.patchState({ durationHours: 0 });
  else page.pickDuration(value);
}
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell
    :active="pageActive"
    v-else
    variant="form"
    :title="page.editingId ? '调整这局' : page.proxyMode ? '帮朋友开一局' : '发起一局'"
    subtitle="选好游戏和时间，把邀请发给队友。"
  >
    <view v-if="page.editingId" class="form-note"
      ><text>正在编辑已有队伍</text
      ><wd-button size="small" variant="text" @click="page.startNew">改为新建</wd-button></view
    >
    <view v-if="page.fromLast" class="form-note">已沿用上一局配置，请核对房间号与密码。</view>
    <view v-if="page.state.weeklyId" class="form-note"
      >已带入周五 21:00 的活动游戏和时间。修改游戏或开局时间后，将作为普通队伍发布。</view
    >
    <wd-form ref="form" :model="page.state" :schema="schema" title-width="84px" center border>
      <view class="section-label">游戏与平台</view>
      <view class="form-section">
        <view id="field-game"
          ><app-input
            prop="gameName"
            label="游戏"
            :model-value="page.gameName"
            :maxlength="40"
            clearable
            required
            placeholder="输入游戏名"
            :error="errorFor('field-game')"
            @update:model-value="page.onGameName(String($event))"
        /></view>
        <wd-cell
          title="常玩游戏"
          :value="page.gameName ? '重新选择' : '从游戏列表选择'"
          is-link
          @click="showGames = true"
        />
        <view id="field-platform"
          ><app-picker
            label="平台"
            :model-value="page.selectedPlatform"
            :columns="page.platforms"
            @confirm="page.pickPlatform(String($event.value))"
        /></view>
        <app-input
          label="区服"
          :model-value="page.server"
          :maxlength="20"
          placeholder="选填，如国服、微信区"
          @update:model-value="page.onServer(String($event))"
        />
      </view>
      <view class="section-label">时间与人数</view>
      <view class="form-section">
        <view id="field-start" class="form-segments"
          ><view class="text-sm mb-3">什么时候开始</view
          ><wd-segmented
            :value="page.startPreset"
            :options="starts"
            custom-class="glass-segment !flex !w-full"
            @change="page.pickStartPreset(String($event.value))"
            ><template #label="{ option }">{{ option.payload.label }}</template></wd-segmented
          ></view
        >
        <app-datetime-picker
          v-if="page.startPreset === 'custom'"
          label="开始时间"
          type="datetime"
          :model-value="page.startTimestamp"
          :min-date="page.minTimestamp"
          :max-date="page.maxTimestamp"
          @confirm="page.changeStart(Number($event.value))"
        />
        <view v-if="errorFor('field-start')" class="field-error px-4">{{ errorFor('field-start') }}</view>
        <view id="field-end" class="form-segments"
          ><view class="text-sm mb-3">预计玩多久</view
          ><wd-segmented
            :value="page.durationHours"
            :options="durations"
            custom-class="glass-segment !flex !w-full"
            @change="duration($event.value)"
            ><template #label="{ option }">{{ option.payload.label }}</template></wd-segmented
          ></view
        >
        <app-picker
          v-if="page.durationHours === 0"
          label="自定义时长"
          :model-value="page.state.durationMinutes"
          :columns="page.durationOptions"
          @confirm="page.changeDuration(Number($event.value))"
        />
        <wd-cell id="field-capacity" title="总人数" label="包含你"
          ><wd-input-number v-model="page.capacity" disable-input :min="page.state.minimumCapacity" :max="20"
        /></wd-cell>
      </view>
      <view class="form-note">{{ page.timeSummaryLine1 }} · {{ page.capacity }} 人</view>
      <view v-if="errorFor('field-end') || errorFor('field-capacity')" class="field-error mb-3">{{
        errorFor('field-end') || errorFor('field-capacity')
      }}</view>
      <view class="section-label">进入游戏</view>
      <view class="form-section"
        ><view id="field-room"
          ><app-input
            prop="roomNo"
            label="加入方式"
            :model-value="page.roomNo"
            :maxlength="80"
            required
            :placeholder="page.roomPlaceholder"
            :error="errorFor('field-room')"
            @update:model-value="page.onRoomNo(String($event))" /></view
      ></view>
      <view class="form-note">可以填写房间号、好友代码，或游戏内的加入方式。</view>
      <view class="form-section"
        ><wd-collapse
          :model-value="page.showMore ? ['extra'] : []"
          @change="
            page.patchState({ showMore: Array.isArray($event.value) && $event.value.includes('extra') })
          "
          ><wd-collapse-item name="extra" title="更多设置 · 选填">
            <app-input
              label="房间密码"
              :model-value="page.roomPwd"
              :maxlength="32"
              placeholder="仅队伍成员可见"
              @update:model-value="page.onRoomPwd(String($event))"
            />
            <app-picker
              label="语音"
              :model-value="page.voice"
              :columns="page.voices"
              @confirm="page.pickVoice(String($event.value))"
            />
            <app-input
              label="队友要求"
              :model-value="page.rankReq"
              :maxlength="20"
              placeholder="娱乐局、上分、萌新友好"
              @update:model-value="page.onRank(String($event))"
            />
            <app-textarea
              label="备注"
              :model-value="page.note"
              :maxlength="500"
              show-word-count
              auto-height
              placeholder="其他想告诉队友的事"
              @update:model-value="page.onNote(String($event))"
            /> </wd-collapse-item></wd-collapse
      ></view>
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
    </wd-form>
    <view v-if="page.state.editLoadError" class="panel"
      ><view class="field-error">{{ page.state.editLoadError }}</view
      ><wd-button variant="text" @click="page.loadEdit(page.editingId)">重新加载</wd-button></view
    >
    <app-action-dock :active="pageActive"
      ><wd-button
        block
        :loading="page.submitting"
        :disabled="page.submitting || !!page.state.editLoadError"
        @click="submit"
        >{{ page.editingId ? '保存修改' : page.proxyMode && page.proxyHost ? '帮 TA 发布' : '发布队伍'
        }}<wd-icon name="arrow-right" size="16px" custom-class="!ml-2" /></wd-button
    ></app-action-dock>
    <wd-select-picker
      v-model:visible="showGames"
      type="radio"
      root-portal
      filterable
      :z-index="1200"
      title="选择游戏"
      :model-value="page.gameName"
      :columns="games"
      @confirm="page.pickSuggestedGame(String($event.value))"
    />
    <profile-gate
      :show="page.showProfile"
      @done="page.onProfileDone"
      @close="page.onProfileClose"
    /><entry-notices />
  </app-shell>
</template>
