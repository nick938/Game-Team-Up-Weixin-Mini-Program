<script setup lang="ts">
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'AdminAdminPage' });
import { reactive } from 'vue';
import { useAdmin } from '../../composables/useAdmin';
const page = reactive(useAdmin());
</script>
<template>
  <app-shell title="管理端" subtitle="数据概览、组队、用户与反馈处理。">
    <wd-empty v-if="page.denied" tip="你没有管理权限，请联系管理员" />
    <template v-else
      ><view class="mb-5"
        ><wd-tabs
          :model-value="page.tab"
          slidable="always"
          :map-num="99"
          line-theme="text"
          @change="page.pickTab(String($event.name))"
          ><wd-tab
            v-for="tab in [
              { key: 'overview', label: '概览' },
              { key: 'teams', label: '组队' },
              { key: 'users', label: '用户' },
              { key: 'report', label: '举报' },
              { key: 'bug', label: '报错' },
              { key: 'feedback', label: '反馈' },
            ]"
            :key="tab.key"
            :name="tab.key"
            :title="tab.label" /></wd-tabs
      ></view>
      <wd-loading v-if="page.loading" />
      <admin-overview v-else-if="page.tab === 'overview' && page.stats" :stats="page.stats" />
      <template v-else-if="page.tab === 'users'"
        ><wd-search
          :model-value="page.userKeyword"
          placeholder="搜昵称或 OpenID"
          hide-cancel
          @update:model-value="page.onUserSearch(String($event))"
        /><wd-cell
          title="只看已封禁"
          :value="page.bannedOnly ? '是' : '否'"
          is-link
          @click="page.toggleBannedOnly"
        /><view class="hint my-4">共 {{ page.userTotal }} 人 · 显示 {{ page.list.length }} 人</view>
        <wd-card
          v-for="user in page.list"
          :key="user._id"
          :title="user.nickName || '玩家'"
          custom-class="!mx-0 !mb-4"
          ><view class="flex gap-2 mb-3"
            ><wd-tag v-if="user.banned" type="danger">已封禁</wd-tag
            ><wd-tag v-if="user.isOrganizer" type="primary">组局员</wd-tag></view
          ><view class="hint break-all">{{ user.openid }}</view
          ><view class="hint my-2">发车 {{ user.hosted }} · 上车 {{ user.joined }}</view
          ><view v-if="user.banReason" class="text-danger text-sm mb-3">原因：{{ user.banReason }}</view
          ><view class="flex flex-wrap gap-2"
            ><wd-button
              v-if="!user.banned"
              size="small"
              type="danger"
              variant="soft"
              @click="page.onBan({ id: user._id, name: user.nickName || '该用户' })"
              >封禁</wd-button
            ><wd-button
              v-else
              size="small"
              variant="soft"
              @click="page.onUnban({ id: user._id, name: user.nickName || '该用户' })"
              >解封</wd-button
            ><wd-button
              v-if="!user.banned && !user.envOrganizer"
              size="small"
              variant="soft"
              @click="
                page.onToggleOrganizer({
                  id: user._id,
                  name: user.nickName || '该用户',
                  on: !!user.isOrganizer,
                })
              "
              >{{ user.isOrganizer ? '取消组局员' : '设为组局员' }}</wd-button
            ></view
          ></wd-card
        >
      </template>
      <template v-else-if="page.tab === 'teams'"
        ><view class="hint mb-4">进行中 {{ page.list.length }} 趟</view
        ><wd-card v-for="team in page.list" :key="team._id" :title="team.gameName" custom-class="!mx-0 !mb-4"
          ><wd-tag type="primary">{{ team.statusText }}</wd-tag
          ><view class="hint my-3"
            >{{ team.timeText }} · {{ team.memberCount }}/{{ team.capacity }} 人 · 车头：{{
              team.hostNickName
            }}</view
          ><wd-button
            size="small"
            type="danger"
            variant="soft"
            @click="page.onCloseTeam({ id: team._id, name: team.gameName || '这趟车' })"
            >强制关闭</wd-button
          ></wd-card
        ></template
      >
      <template v-else-if="page.tab !== 'overview'"
        ><wd-cell
          title="只看未处理"
          :value="page.onlyOpen ? '是' : '否'"
          is-link
          @click="page.toggleOpen"
        /><wd-card
          v-for="record in page.list"
          :key="record._id"
          :title="record.tag || '记录'"
          custom-class="!mx-0 !mb-4"
          ><view class="hint mb-3">{{ record.timeText }} · {{ record.nickName }}</view
          ><view class="text-sm whitespace-pre-wrap break-words leading-6">{{
            record.content || '（无补充说明）'
          }}</view
          ><view v-if="record.errorMsg" class="text-danger text-sm break-words my-2">{{
            record.errorMsg
          }}</view
          ><view class="hint my-3">{{ record.targetName || record.page }} {{ record.version }}</view
          ><view v-if="record.hostOpenid" class="hint break-all mb-2">车头：{{ record.hostOpenid }}</view
          ><view v-if="record.systemInfo" class="hint mb-2">{{ record.systemInfo }}</view
          ><wd-button
            size="small"
            variant="soft"
            @click="page.onHandle({ id: record._id, handled: !!record.handled })"
            >{{ record.handled ? '重新打开' : '标记已处理' }}</wd-button
          ></wd-card
        ></template
      >
      <wd-empty v-if="!page.loading && page.tab !== 'overview' && !page.list.length" tip="没有符合条件的记录"
    /></template>
  </app-shell>
</template>
