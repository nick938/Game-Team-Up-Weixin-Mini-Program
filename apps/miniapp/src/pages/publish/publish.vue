<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
import { reactive } from 'vue';
import { usePublish } from '../../composables/usePublish';
defineOptions({ name: 'PublishPublishPage' });
useAppTheme();
const page = reactive(usePublish());
function errorFor(anchor: string) {
  return page.state.validationError?.anchor === anchor ? page.state.validationError.message : '';
}
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell
    v-else
    variant="form"
    :title="page.editingId ? '调整这趟车' : page.proxyMode ? '帮群友开一局' : '喊上好友，开一局'"
    subtitle="约好游戏和时间，发车后分享给好友。"
  >
    <view v-if="page.canProxy && !page.editingId" class="mb-4">
      <wd-cell-group
        ><wd-cell title="帮群友发车" label="以朋友身份发起，他将成为车头"
          ><wd-switch
            :model-value="page.proxyMode"
            @update:model-value="page.toggleProxy(Boolean($event))" /></wd-cell
      ></wd-cell-group>
    </view>
    <view v-if="page.proxyMode && !page.editingId" id="field-proxy" class="panel">
      <view class="section-title mb-3">帮谁发车</view>
      <wd-cell
        v-if="page.proxyHost"
        :title="page.proxyHost.nickName"
        value="换一个"
        is-link
        @click="page.clearProxyHost"
      />
      <template v-else>
        <wd-search
          :model-value="page.proxyKeyword"
          hide-cancel
          placeholder="搜对方在小程序里的昵称"
          @update:model-value="page.onProxyKeyword(String($event))"
        />
        <view class="hint my-3">对方需要先打开过小程序并设置昵称</view
        ><wd-loading v-if="page.proxySearching" />
        <wd-cell
          v-for="user in page.proxyResults"
          :key="user.userId"
          :title="user.nickName"
          is-link
          @click="page.pickProxyHost(user)"
        />
        <view v-if="page.proxyKeyword && !page.proxySearching && !page.proxyResults.length" class="hint"
          >没找到这个昵称</view
        >
      </template>
      <view v-if="errorFor('field-proxy')" class="field-error">{{ errorFor('field-proxy') }}</view>
    </view>
    <view class="section-title mt-6 mb-3">玩什么</view>
    <view id="field-game"
      ><wd-cell-group
        ><app-input
          label="游戏"
          :model-value="page.gameName"
          :maxlength="40"
          clearable
          required
          placeholder="输入游戏名，也可以选下方推荐"
          :error="errorFor('field-game')"
          @update:model-value="page.onGameName(String($event))" /></wd-cell-group
    ></view>
    <view class="flex flex-wrap gap-2 my-3">
      <wd-button
        v-for="game in page.suggestedGames"
        :key="game.slug"
        size="small"
        round
        :variant="page.gameName === game.name ? 'base' : 'soft'"
        @click="page.pickSuggestedGame(game.slug)"
        >{{ game.name }}</wd-button
      >
    </view>
    <view v-if="page.fromLast" class="hint mb-3">已填入上一趟，时间改到最近</view>
    <view id="field-platform"
      ><wd-cell-group
        ><app-picker
          label="平台"
          :model-value="page.selectedPlatform"
          :columns="page.platforms"
          @confirm="page.pickPlatform(String($event.value))" /></wd-cell-group
    ></view>
    <view class="section-title mt-6 mb-3">什么时候</view>
    <view id="field-start" class="panel">
      <view class="text-sm font-semibold mb-3">开始时间 <text class="text-danger">*</text></view>
      <view class="flex flex-wrap gap-2 mb-3"
        ><wd-button
          v-for="preset in page.startPresets"
          :key="preset.key"
          size="small"
          :variant="page.startPreset === preset.key ? 'base' : 'soft'"
          @click="page.pickStartPreset(preset.key)"
          >{{ preset.label }}</wd-button
        ></view
      >
      <app-datetime-picker
        label="选择时间"
        type="datetime"
        :model-value="page.startTimestamp"
        :min-date="page.minTimestamp"
        :max-date="page.maxTimestamp"
        @confirm="page.changeStart(Number($event.value))"
      />
      <view v-if="errorFor('field-start')" class="field-error">{{ errorFor('field-start') }}</view>
    </view>
    <view id="field-end" class="panel">
      <view class="text-sm font-semibold mb-3">玩多久</view>
      <view class="flex flex-wrap gap-2 mb-3"
        ><wd-button
          v-for="preset in page.durationPresets.filter((item) => item.hours > 0)"
          :key="preset.hours"
          size="small"
          :variant="page.durationHours === preset.hours ? 'base' : 'soft'"
          @click="page.pickDuration(preset.hours)"
          >{{ preset.label }}</wd-button
        ></view
      >
      <app-picker
        label="自定义时长"
        :model-value="page.state.durationMinutes"
        :columns="page.durationOptions"
        @confirm="page.changeDuration(Number($event.value))"
      />
      <view class="rounded-xl bg-brand-light p-3 mt-3"
        ><view class="text-sm font-medium text-brand">{{ page.timeSummaryLine1 }}</view
        ><view class="hint mt-1">{{ page.timeSummaryLine2 }}</view></view
      >
      <view v-if="errorFor('field-end')" class="field-error">{{ errorFor('field-end') }}</view>
    </view>
    <view class="section-title mt-6 mb-3">怎么进</view>
    <wd-cell-group>
      <wd-cell id="field-capacity" title="队伍人数" label="包含车头"
        ><wd-input-number v-model="page.capacity" disable-input :min="2" :max="20"
      /></wd-cell>
      <view id="field-room"
        ><app-input
          label="房间 / 加入方式"
          :model-value="page.roomNo"
          :maxlength="80"
          required
          placeholder="房间号 / Steam 好友代码 / 房间码"
          :error="errorFor('field-room')"
          @update:model-value="page.onRoomNo(String($event))"
      /></view>
      <app-input
        label="房间密码（选填）"
        :model-value="page.roomPwd"
        :maxlength="32"
        placeholder="没有就留空"
        help="仅按队伍成员权限展示，分享卡片不含密码"
        @update:model-value="page.onRoomPwd(String($event))"
      />
    </wd-cell-group>
    <view v-if="errorFor('field-capacity')" class="field-error">{{ errorFor('field-capacity') }}</view>
    <view class="section-title mt-6 mb-3"
      >补充要求 <text class="text-sm font-normal text-muted">选填</text></view
    >
    <wd-cell-group
      ><wd-cell
        title="区服、语音与队友要求"
        :label="page.moreHint"
        is-link
        :arrow-direction="page.showMore ? 'up' : 'down'"
        @click="page.toggleMore"
    /></wd-cell-group>
    <view v-if="page.showMore" class="mt-3">
      <wd-cell-group>
        <app-input
          label="区服"
          :model-value="page.server"
          :maxlength="20"
          placeholder="如国服、微信区"
          @update:model-value="page.onServer(String($event))"
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
          placeholder="玩法、麦序、怎么加好友"
          @update:model-value="page.onNote(String($event))"
        />
      </wd-cell-group>
    </view>
    <view class="mt-6 mb-4"
      ><wd-button
        block
        size="large"
        :loading="page.submitting"
        :disabled="page.submitting"
        @click="page.onSubmit"
        >{{
          page.editingId
            ? '保存修改'
            : page.proxyMode && page.proxyHost
              ? '帮 TA 发布组队'
              : '发布组队 · ' + page.capacity + ' 人'
        }}</wd-button
      ></view
    >
    <view class="hint text-center mb-4">发布后，把队伍分享给想一起玩的好友</view>
    <profile-gate
      :show="page.showProfile"
      @done="page.onProfileDone"
      @close="page.onProfileClose"
    /><welcome-letter />
  </app-shell>
</template>
