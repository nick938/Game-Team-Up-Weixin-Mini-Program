<script setup lang="ts">
defineOptions({ name: 'TeamDetailPage' });
import { reactive } from 'vue';
import { useTeamDetail } from '../../composables/useTeamDetail';
const page = reactive(useTeamDetail());
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else>
    <template v-if="page.team">
      <view class="panel bg-gradient-to-br from-brand-light to-white"
        ><view class="flex gap-2 mb-4"
          ><wd-tag :type="page.team.displayStatus === 'full' ? 'success' : 'primary'">{{
            page.team.statusText
          }}</wd-tag
          ><wd-tag v-if="page.team.started">进行中</wd-tag
          ><wd-tag v-else-if="page.team.soon" type="success">即将开始</wd-tag></view
        >
        <view class="page-heading">{{ page.team.gameName }}</view
        ><view v-if="page.team.proxyNickName" class="hint mt-2">由 {{ page.team.proxyNickName }} 代开</view
        ><view class="page-caption">{{ page.team.timeText }}</view>
        <view class="text-2xl font-bold my-4"
          >{{ page.team.memberCount }}/{{ page.team.capacity }}
          <text v-if="page.team.displayStatus === 'recruiting'" class="text-brand text-base"
            >还差 {{ page.team.needCount }} 人</text
          ></view
        >
        <view class="flex flex-wrap gap-2"
          ><wd-tag
            v-for="tag in [page.team.platform, page.team.server, page.team.voice, page.team.rankReq].filter(
              (value) => value && value !== '不限',
            )"
            :key="tag"
            >{{ tag }}</wd-tag
          ></view
        >
        <view v-if="page.wechatSubscription && page.role && page.team.ongoing" class="mt-4"
          ><wd-button
            size="small"
            variant="soft"
            :disabled="page.notifyAuthorized"
            @click="page.onEnableNotify"
            >{{ page.notifyAuthorized ? '已授权开打前提醒' : '开打前 10 分钟提醒我' }}</wd-button
          ><view v-if="page.notifyHint" class="hint mt-2">{{ page.notifyHint }}</view></view
        >
        <view v-if="page.team.note" class="mt-4"
          ><view
            class="text-sm whitespace-pre-wrap break-words leading-6"
            :class="page.noteCanFold && !page.noteExpanded ? 'line-clamp-3' : ''"
            >{{ page.team.note }}</view
          ><wd-button v-if="page.noteCanFold" variant="text" size="small" @click="page.toggleNoteExpand">{{
            page.noteExpanded ? '收起' : '展开全部'
          }}</wd-button></view
        >
      </view>
      <wd-cell-group v-if="page.team.roomNo || page.role || page.team.hasPwd"
        ><wd-cell
          v-if="page.team.roomNo"
          title="房间 / 好友码"
          :value="page.team.roomNo"
          is-link
          @click="page.copyRoom" /><wd-cell
          v-if="page.role"
          title="密码"
          :value="page.team.roomPwd || '无'"
          @click="page.copyPwd" /><wd-cell v-else-if="page.team.hasPwd" title="进房密码" value="加入后可见"
      /></wd-cell-group>
      <view class="panel mt-4"
        ><view class="section-title">这局的队友 {{ page.members.length }}/{{ page.team.capacity }}</view
        ><view class="hint my-3">点头像，查看队友的游戏资料</view
        ><view class="grid grid-cols-4 gap-4"
          ><view v-for="seat in page.seats" :key="seat.key" class="text-center min-w-0"
            ><template v-if="seat.member"
              ><wd-button
                variant="text"
                custom-class="!p-0 !h-auto"
                @click="page.onMemberProfile(seat.member._id)"
                ><image
                  class="avatar"
                  :src="
                    seat.member.avatarUrl ||
                    (seat.member.avatarBase64
                      ? 'data:image/jpeg;base64,' + seat.member.avatarBase64
                      : '/static/images/avatar.png')
                  "
                  mode="aspectFill" /></wd-button
              ><view class="text-xs truncate mt-2">{{ seat.member.nickName || '玩家' }}</view
              ><wd-tag v-if="seat.member.role === 'host'" size="small" type="primary">车头</wd-tag></template
            ><template v-else
              ><view class="avatar bg-brand-light text-brand flex-center mx-auto text-2xl">＋</view
              ><view class="hint mt-2">{{ page.team.ongoing ? '等队友' : '空位' }}</view></template
            ></view
          ></view
        ></view
      >
      <view v-if="page.team.ongoing" class="flex flex-col gap-3 my-5"
        ><wd-button
          v-if="!page.role && page.team.displayStatus === 'recruiting'"
          block
          :loading="page.state.joining"
          @click="page.onJoin"
          >{{ page.team.started ? '中途加入' : '上车' }} · 还差 {{ page.team.needCount }} 人</wd-button
        ><wd-button block open-type="share" :variant="page.role ? 'base' : 'soft'">{{
          page.team.displayStatus === 'full' ? '分享队伍' : '邀请好友'
        }}</wd-button
        ><wd-button v-if="page.role === 'host'" block variant="soft" @click="page.onManage">管理</wd-button
        ><wd-button v-if="page.role === 'member'" block variant="soft" @click="page.onLeave">下车</wd-button
        ><wd-button
          v-if="!page.role && page.team.displayStatus === 'full'"
          block
          variant="soft"
          @click="page.goPlaza"
          >已满员，看看别的局</wd-button
        ></view
      >
      <view v-else class="panel text-center"
        ><wd-empty
          :tip="page.team.displayStatus === 'cancelled' ? '这趟已经散了' : '这局已结束，下次再一起玩'"
        /><wd-button block variant="soft" @click="page.goPlaza">回大厅</wd-button
        ><view v-if="page.role === 'host'" class="mt-3"
          ><wd-button block @click="page.onRepublish">再发一趟</wd-button></view
        ></view
      >
      <view v-if="page.role !== 'host'" class="text-center my-4"
        ><wd-button variant="text" type="danger" size="small" @click="page.onReport"
          >举报这趟车</wd-button
        ></view
      >
    </template>
    <wd-loading v-else-if="page.loading" /><view v-else class="panel text-center"
      ><wd-empty
        :tip="page.teamId ? '这趟可能已经散了，或链接失效了' : '链接不完整，请让车头重新分享'"
      /><wd-button @click="page.goPlaza">去大厅看看</wd-button></view
    >
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
    <profile-gate :show="page.showProfile" @done="page.onProfileDone" @close="page.onProfileClose" /><canvas
      v-if="page.team"
      type="2d"
      id="shareCover"
      class="fixed -left-[2000px] top-0 w-[375px] h-[300px] pointer-events-none"
    /><welcome-letter />
  </app-shell>
</template>
