<script setup lang="ts">
import { usePageActive } from '../../composables/usePageActive';
const pageActive = usePageActive('pages/mine/mine');
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'MineMinePage' });
import { reactive } from 'vue';
import NextTeam from '../../components/next-team/index.vue';
import { useMine } from '../../composables/useMine';
const page = reactive(useMine());
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell :active="pageActive" v-else variant="profile">
    <view class="panel profile-panel !p-4">
      <wd-cell-group custom-class="!bg-transparent !shadow-none"
        ><wd-cell
          custom-class="profile-cell !bg-transparent !p-0"
          custom-title-class="font-semibold"
          :title="page.user.nickName || '点这里设置头像昵称'"
          :label="page.profileHint"
          is-link
          @click="page.editProfile"
          ><template #prefix
            ><wd-avatar
              size="large"
              shape="square"
              mode="aspectFill"
              :src="page.user.avatarUrl || '/static/images/avatar.png'"
              custom-class="mr-3" /></template></wd-cell
      ></wd-cell-group>
    </view>
    <view v-if="page.state.profileError" class="panel flex items-center justify-between gap-3"
      ><text class="text-sm text-secondary">{{ page.state.profileError }}</text
      ><wd-button size="small" variant="soft" @click="page.load(true)">重试</wd-button></view
    >
    <next-team v-if="page.nextTeam" :team="page.nextTeam" @open="page.onOpen" @refresh="page.load()" />
    <view class="mt-6 mb-4"
      ><wd-tabs :model-value="page.teamTab" line-theme="text" @change="page.pickTeamTab(String($event.name))"
        ><wd-tab name="hosted" :title="'我发起的 ' + page.hostedCount" /><wd-tab
          name="joined"
          :title="'我加入的 ' + page.joinedCount" /></wd-tabs
    ></view>
    <wd-segmented
      :value="page.phase"
      :options="[
        { value: 'Ongoing', payload: { label: '未结束' } },
        { value: 'Past', payload: { label: '历史记录' } },
      ]"
      custom-class="glass-segment !flex !w-full !mb-5"
      @change="page.pickPhase(String($event.value))"
      ><template #label="{ option }">{{ option.payload.label }}</template></wd-segmented
    >
    <view v-if="page.state.listError" class="panel"
      ><view class="text-sm text-secondary mb-3">{{ page.state.listError }}</view
      ><wd-button variant="soft" :loading="page.state.loading" @click="page.load(true)"
        >重新加载</wd-button
      ></view
    >
    <view v-if="page.state.loading && !page.visibleTeams.length" class="panel" aria-label="正在加载队伍"
      ><wd-skeleton
        animation="gradient"
        :row-col="[
          { width: '160px', height: '24px' },
          { width: '100%', height: '16px' },
        ]"
    /></view>
    <team-card
      v-for="team in page.visibleTeams"
      :key="team._id"
      :team="team"
      :team-id="team.id || team._id"
      :mark="page.teamTab === 'hosted' ? '车头' : '队员'"
      @open="page.onOpen"
    />
    <view v-if="!page.visibleTeams.length && !page.state.loading && !page.state.listError" class="empty-state"
      ><wd-empty
        icon="empty"
        :icon-size="58"
        :tip="
          page.phase === 'Past'
            ? '还没有历史记录'
            : page.teamTab === 'hosted'
              ? '还没有待开的队伍'
              : '还没有加入队伍'
        " /><view class="hint mb-2">{{
        page.phase === 'Past' ? '结束的队伍会保存在这里' : '约好时间，和队友一起出发'
      }}</view
      ><wd-button v-if="page.phase === 'Ongoing'" variant="text" @click="page.goPlaza"
        >去大厅看看 <wd-icon name="arrow-right" size="14px" /></wd-button
    ></view>
    <view class="section-label">服务与设置</view>
    <wd-cell-group
      ><wd-cell title="更新日志" label="看看最近更新了什么" is-link @click="page.openChangelog" /><wd-cell
        v-if="page.isOrganizer && !page.isAdmin"
        title="帮群友发车"
        is-link
        @click="page.openPublish" /><wd-cell
        v-if="page.isAdmin"
        title="管理端"
        is-link
        @click="page.openAdmin" /><wd-cell
        title="帮助与反馈"
        label="常见问题、意见反馈、报错与联系作者"
        is-link
        @click="page.openHelp" /><wd-cell title="社区公约" is-link @click="page.openLegal('community')"
    /></wd-cell-group>
    <view class="hint text-center py-5">{{ page.versionText }}</view
    ><profile-gate
      :show="page.showProfile"
      @done="page.onProfileDone"
      @close="page.onProfileClose"
    /><entry-notices />
  </app-shell>
</template>
