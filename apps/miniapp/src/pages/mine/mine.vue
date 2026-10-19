<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'MineMinePage' });
import { reactive } from 'vue';
import { useMine } from '../../composables/useMine';
const page = reactive(useMine());
</script>
<template>
  <timeline-preview v-if="page.singlePage" />
  <app-shell v-else variant="profile">
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
            ><image
              class="avatar box-border mr-3 border-3 border-solid border-white surface-shadow"
              :src="
                page.user.avatarUrl ||
                (page.user.avatarBase64
                  ? 'data:image/jpeg;base64,' + page.user.avatarBase64
                  : '/static/images/avatar.png')
              "
              mode="aspectFill" /></template></wd-cell
      ></wd-cell-group>
    </view>
    <view v-if="page.state.profileError" class="panel flex items-center justify-between gap-3"
      ><text class="text-sm text-secondary">{{ page.state.profileError }}</text
      ><wd-button size="small" variant="soft" @click="page.load">重试</wd-button></view
    >
    <view class="section-title mt-6 mb-3">我的队伍</view>
    <view class="flex flex-wrap gap-2 mb-3"
      ><wd-button :variant="page.teamTab === 'hosted' ? 'base' : 'soft'" @click="page.pickTeamTab('hosted')"
        >我发起的 {{ page.hostedCount }}</wd-button
      ><wd-button :variant="page.teamTab === 'joined' ? 'base' : 'soft'" @click="page.pickTeamTab('joined')"
        >我加入的 {{ page.joinedCount }}</wd-button
      ></view
    >
    <view class="flex gap-2 mb-4"
      ><wd-button
        size="small"
        :variant="page.phase === 'Ongoing' ? 'base' : 'soft'"
        @click="page.pickPhase('Ongoing')"
        >进行中</wd-button
      ><wd-button
        size="small"
        :variant="page.phase === 'Past' ? 'base' : 'soft'"
        @click="page.pickPhase('Past')"
        >历史</wd-button
      ></view
    >
    <view v-if="page.state.listError" class="panel"
      ><view class="text-sm text-secondary mb-3">{{ page.state.listError }}</view
      ><wd-button variant="soft" :loading="page.state.loading" @click="page.load">重新加载</wd-button></view
    >
    <view v-if="page.state.loading && !page.visibleTeams.length" class="panel"
      ><view class="skeleton-shape h-6 w-40 mb-4" /><view class="skeleton-shape h-4 w-full"
    /></view>
    <team-card
      v-for="team in page.visibleTeams"
      :key="team._id"
      :team="team"
      :team-id="team.id || team._id"
      :mark="page.teamTab === 'hosted' ? '车头' : '队员'"
      @open="page.onOpen"
    />
    <view
      v-if="!page.visibleTeams.length && !page.state.loading && !page.state.listError"
      class="panel text-center"
      ><wd-empty
        icon="/static/images/brand/empty-v1.jpg"
        :tip="page.phase === 'Past' ? '还没有历史组队' : '下一局，等你出发'"
      /><wd-button v-if="page.phase === 'Ongoing'" variant="soft" @click="page.goPlaza"
        >去大厅看看</wd-button
      ></view
    >
    <view class="section-title mt-6 mb-3">帮助与设置</view>
    <wd-cell-group
      ><wd-cell
        v-if="page.isOrganizer && !page.isAdmin"
        title="帮群友发车"
        is-link
        @click="page.openPublish" /><wd-cell
        v-if="page.isAdmin"
        title="管理端"
        is-link
        @click="page.openAdmin" /><wd-cell title="联系作者" is-link @click="page.openAuthor" /><wd-cell
        title="意见反馈"
        is-link
        @click="page.openFeedback" /><wd-cell title="报个错" is-link @click="page.openBug" /><wd-cell
        title="用户协议"
        is-link
        @click="page.openLegal('agreement')" /><wd-cell
        title="隐私政策"
        is-link
        @click="page.openLegal('privacy')" /><wd-cell
        title="社区公约"
        is-link
        @click="page.openLegal('community')"
    /></wd-cell-group>
    <view class="hint text-center py-5">{{ page.versionText }}</view
    ><profile-gate
      :show="page.showProfile"
      @done="page.onProfileDone"
      @close="page.onProfileClose"
    /><welcome-letter />
  </app-shell>
</template>
