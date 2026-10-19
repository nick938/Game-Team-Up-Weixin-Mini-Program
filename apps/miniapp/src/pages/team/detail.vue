<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/team/detail');
import AppActionDock from '../../components/app-action-dock/index.vue';
import { useAppTheme } from '../../composables/useAppTheme';
import { reactive, computed } from 'vue';
import { useTeamDetail } from '../../composables/useTeamDetail';
import { useTeamPresentation } from '../../composables/useTeamPresentation';
import { platform } from '../../platform/host';
defineOptions({ name: 'TeamDetailPage' });
useAppTheme();
const page = reactive(useTeamDetail());
const view = useTeamPresentation(
  () => page.team || {},
  () => page.role,
  () => {
    void page.loadDetail();
  },
);
const tags = computed(() =>
  [page.team?.platform, page.team?.server, page.team?.voice, page.team?.rankReq].filter(
    (value) => value && value !== '不限',
  ),
);
function goRoom() {
  platform.pageScrollTo({ selector: '#room-info', duration: 220 });
}
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell :active="pageActive" v-else variant="detail">
    <view class="flex items-center justify-between mb-3">
      <text class="brand-kicker">队伍邀请</text>
      <wd-button variant="text" size="small" @click="page.goPlaza"
        >去大厅 <wd-icon name="arrow-right" size="14px"
      /></wd-button>
    </view>
    <template v-if="page.team">
      <view class="panel">
        <view class="flex flex-wrap items-center gap-2 mb-3">
          <text
            class="room-status"
            :class="
              view.tone === 'open'
                ? 'bg-success-soft text-success'
                : view.tone === 'full'
                  ? 'bg-brand-light text-brand'
                  : 'bg-surface-muted text-secondary'
            "
            >{{ view.statusLabel }}</text
          >
          <text v-if="view.timeLabel" class="hint">{{ view.timeLabel }}</text>
          <text v-if="page.role" class="hint">{{ page.role === 'host' ? '我发起的' : '已加入' }}</text>
        </view>
        <view class="page-heading">{{ page.team.gameName }}</view>
        <view class="room-meta flex items-start gap-2 mt-3"
          ><wd-icon name="time-line" size="16px" /><text>{{ page.team.timeText }}</text></view
        >
        <view class="flex items-baseline gap-2 my-4">
          <text class="text-2xl font-bold">{{ page.team.memberCount }} / {{ page.team.capacity }}</text>
          <text class="text-sm text-secondary">人已上车</text>
        </view>
        <view v-if="tags.length" class="flex flex-wrap gap-2"
          ><text v-for="(tag, index) in tags" :key="index" class="room-tag break-words">{{ tag }}</text></view
        >
        <view class="text-xs text-secondary break-words mt-3"
          >来源群 · {{ page.team.sourceGroup || '未标注群' }}</view
        >
        <view class="hint mt-1">来源仅作标识，欢迎跨群上车。</view>
        <view v-if="page.team.proxyNickName" class="hint mt-3">由 {{ page.team.proxyNickName }} 代开</view>
      </view>
      <view v-if="page.state.changeNotice" class="panel !bg-brand-light text-sm">{{
        page.state.changeNotice
      }}</view>
      <view v-if="page.role === 'member' && view.ongoing" class="panel"
        ><view class="text-sm font-semibold mb-2">{{
          page.state.joinSuccess ? '加入成功，接下来进入游戏' : '你已加入这局'
        }}</view
        ><view class="hint">复制下方房间号或好友码，打开游戏加入队友。这里占位不会自动进入游戏。</view></view
      >
      <app-action-dock :active="pageActive">
        <wd-button
          v-if="view.primaryAction === 'join'"
          block
          :loading="page.state.joining"
          :disabled="page.state.joining"
          @click="page.onJoin"
          >{{ view.lifecycle === 'active' ? '中途加入' : '加入队伍' }} · 还差
          {{ view.needCount }} 人</wd-button
        >
        <wd-button v-else-if="view.primaryAction === 'share'" block open-type="share"
          >邀请好友，一起开黑</wd-button
        >
        <wd-button
          v-else-if="view.primaryAction === 'room'"
          block
          @click="page.team.roomNo ? page.copyRoom() : goRoom()"
          >{{ page.team.roomNo ? '复制加入方式，进入游戏' : '查看进房信息' }}</wd-button
        >
        <wd-button v-else block @click="page.goPlaza">{{
          view.recruitment === 'full'
            ? '这趟已满员，去大厅看看'
            : view.confirmed
              ? '去大厅看看其他队伍'
              : '状态待确认，去大厅看看'
        }}</wd-button>
        <view class="flex flex-wrap gap-2 mt-2">
          <wd-button
            v-if="view.ongoing && view.primaryAction !== 'share'"
            variant="soft"
            block
            open-type="share"
            >分享给好友</wd-button
          >
          <wd-button
            v-if="!view.ongoing && page.role === 'host' && view.confirmed"
            block
            variant="soft"
            @click="page.onRepublish"
            >再发一趟</wd-button
          >
        </view>
      </app-action-dock>
      <view id="room-info" class="panel">
        <view class="section-title mb-3">怎么加入游戏</view>
        <view class="flex items-start justify-between gap-3">
          <view class="min-w-0 flex-1"
            ><view class="hint mb-1">房间 / 好友码</view
            ><view class="text-base break-all whitespace-pre-wrap">{{
              page.team.roomNo || '车头暂未填写'
            }}</view></view
          >
          <wd-button v-if="page.team.roomNo" size="small" variant="soft" @click="page.copyRoom"
            >复制</wd-button
          >
        </view>
        <view
          v-if="page.team.hasPwd || view.canViewPassword || page.role"
          class="flex items-start justify-between gap-3 mt-4 pt-4 border-t border-solid border-border border-x-0 border-b-0"
        >
          <view class="min-w-0 flex-1"
            ><view class="hint mb-1">进房密码</view
            ><view class="text-sm break-all">{{
              view.canViewPassword
                ? page.team.roomPwd || '无密码'
                : page.role === 'member'
                  ? '当前不可见'
                  : '加入后可见'
            }}</view></view
          >
          <wd-button
            v-if="view.canViewPassword && page.team.roomPwd"
            size="small"
            variant="soft"
            @click="page.copyPwd"
            >复制</wd-button
          >
        </view>
      </view>
      <view class="panel">
        <view class="flex justify-between gap-2 mb-1"
          ><view class="section-title">这局的队友</view
          ><text class="text-sm text-secondary"
            >{{ page.members.length }} / {{ page.team.capacity }}</text
          ></view
        >
        <view class="hint mb-4">点头像，查看队友的游戏资料</view>
        <view class="grid grid-cols-4 gap-x-3 gap-y-4">
          <view v-for="seat in page.seats" :key="seat.key" class="text-center min-w-0">
            <template v-if="seat.member">
              <wd-button
                variant="text"
                custom-class="!p-0 !h-auto"
                :aria-label="'查看' + seat.member.nickName + '的资料'"
                @click="page.onMemberProfile(seat.member._id)"
                ><app-avatar
                  :src="seat.member.avatarUrl"
                  :file-id="seat.member.avatarFileID"
                  :identity="seat.member._id"
                  :base64="seat.member.avatarBase64"
              /></wd-button>
              <view class="text-xs truncate mt-2">{{ seat.member.nickName || '玩家' }}</view
              ><view v-if="seat.member.role === 'host'" class="text-xs text-brand mt-1">车头</view>
            </template>
            <template v-else
              ><view class="avatar bg-surface-muted text-muted flex-center mx-auto text-2xl">＋</view
              ><view class="hint mt-2">{{ view.ongoing ? '等队友' : '空位' }}</view></template
            >
          </view>
        </view>
      </view>
      <view class="panel"
        ><view class="section-title mb-1">给这趟车贴个表情</view
        ><view class="hint mb-4">每人一个，再点取消，也可以换一个。</view>
        <view class="grid grid-cols-3 gap-2"
          ><wd-button
            v-for="item in page.REACTIONS"
            :key="item.id"
            :variant="page.state.reactions.mine === item.id ? 'base' : 'soft'"
            :disabled="page.state.reacting || page.loading"
            :aria-label="item.label + '，' + page.state.reactions.counts[item.id] + '人'"
            :aria-pressed="page.state.reactions.mine === item.id"
            @click="page.onReact(item.id)"
            ><text class="text-lg mr-1">{{ item.emoji }}</text
            ><text>{{ page.state.reactions.counts[item.id] }}</text></wd-button
          ></view
        >
      </view>
      <view v-if="page.team.note" class="panel">
        <view class="section-title mb-3">开黑约定</view>
        <view
          class="text-base whitespace-pre-wrap break-words leading-6"
          :class="page.noteCanFold && !page.noteExpanded ? 'line-clamp-3' : ''"
          >{{ page.team.note }}</view
        >
        <wd-button v-if="page.noteCanFold" variant="text" size="small" @click="page.toggleNoteExpand">{{
          page.noteExpanded ? '收起' : '展开全部'
        }}</wd-button>
      </view>
      <view v-if="page.wechatSubscription && page.role && view.ongoing" class="panel">
        <wd-button
          variant="soft"
          block
          :loading="page.state.requestingNotify"
          :disabled="page.notifyAuthorized"
          @click="page.onEnableNotify"
          >{{ page.notifyAuthorized ? '本次已授权提醒' : '开打前提醒我（可选）' }}</wd-button
        ><view class="hint mt-2">开始前 10 分钟内才加入可能赶不上提醒，请留意开局时间。</view
        ><view v-if="page.notifyHint" class="hint mt-2">{{ page.notifyHint }}</view>
      </view>
      <view class="flex flex-wrap gap-2 mt-5">
        <wd-button
          v-if="view.ongoing && page.role === 'host'"
          variant="soft"
          :disabled="page.state.mutating"
          @click="page.onManage"
          >管理队伍</wd-button
        >
        <wd-button
          v-if="view.ongoing && page.role === 'member'"
          variant="text"
          type="danger"
          :loading="page.state.mutating"
          @click="page.onLeave"
          >下车</wd-button
        >
        <wd-button
          v-if="page.role !== 'host'"
          variant="text"
          type="danger"
          size="small"
          @click="page.onReport"
          >举报这趟车</wd-button
        >
      </view>
    </template>
    <view v-else-if="page.loading" class="panel" aria-label="正在加载队伍"
      ><view class="skeleton-shape h-6 w-40 mb-4" /><view class="skeleton-shape h-4 w-full mb-4" /><view
        class="skeleton-shape h-12 w-full"
    /></view>
    <view v-else class="panel text-center">
      <wd-empty
        :tip="
          page.state.detailError
            ? page.state.detailNotFound
              ? '找不到这趟队伍'
              : '暂时无法加载队伍'
            : '链接不完整，请让车头重新分享'
        "
      />
      <view v-if="page.state.detailError && !page.state.detailNotFound" class="hint mb-4">{{
        page.state.detailError
      }}</view>
      <wd-button
        v-if="page.teamId && !page.state.detailNotFound"
        block
        variant="soft"
        custom-class="!mb-3"
        @click="page.loadDetail"
        >重新加载</wd-button
      >
      <wd-button block @click="page.goPlaza">去大厅看看</wd-button>
    </view>
    <view class="h-32" aria-hidden="true" />
    <team-manage-sheet
      v-if="page.role === 'host'"
      :show="page.showManage"
      @close="page.closeManage"
      @action="page.onManageAction"
    />
    <member-profile-sheet
      :show="page.showMemberProfile"
      :loading="page.memberProfileLoading"
      :user="page.memberProfile"
      :error="page.memberProfileError"
      @close="page.closeMemberProfile"
      @retry="page.loadMemberProfile"
    />
    <profile-gate :show="page.showProfile" @done="page.onProfileDone" @close="page.onProfileClose" />
    <canvas
      v-if="page.team"
      type="2d"
      id="shareCover"
      class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
    />
    <welcome-letter />
  </app-shell>
</template>
