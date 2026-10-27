<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { callTeam } from '../../api/team';
import type { AdminRow, FixedTeamPlan } from '../../types/domain';
import AdminHostProfile from '../admin-host-profile/index.vue';
import { usePageFeedback } from '../../composables/usePageFeedback';
const { toast, dialog, showError } = usePageFeedback();
const plans = ref<FixedTeamPlan[]>([]);
defineOptions({ name: 'AdminFixedTeams' });
const busy = ref(false);
const users = ref<AdminRow[]>([]);
const hostKeyword = ref('');
const matchingHosts = computed(() => {
  const key = hostKeyword.value.trim().toLowerCase();
  return key
    ? users.value
        .filter(
          (user) =>
            !user.banned &&
            user.profileReady !== false &&
            user.nickName &&
            `${user.nickName} ${user.openid}`.toLowerCase().includes(key),
        )
        .slice(0, 20)
    : [];
});
function chooseHost(user: AdminRow) {
  form.hostOpenid = user.openid || user._id;
  form.hostNickName = user.nickName;
  hostKeyword.value = '';
}
const loading = ref(true);
const loadError = ref(false);
const editing = ref(false);
const timePicker = ref<'startTime' | 'endTime' | ''>('');
const isNew = ref(true);
function hostFor(plan: FixedTeamPlan) {
  return (
    users.value.find((user) => (user.openid || user._id) === plan.hostOpenid) || {
      nickName: plan.hostNickName,
    }
  );
}
const selectedHost = computed(() => hostFor(form));
const durationText = computed(() => {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const duration = (minutes(form.endTime) - minutes(form.startTime) + 1440) % 1440;
  if (!duration) return '开始和结束时间不能相同';
  return `共${Math.floor(duration / 60) ? Math.floor(duration / 60) + '小时' : ''}${duration % 60 ? (duration % 60) + '分钟' : ''}`;
});
function confirmTime(event: { value: string | number | (string | number)[] }) {
  if (timePicker.value && typeof event.value === 'string') form[timePicker.value] = event.value;
  timePicker.value = '';
}
const form = reactive<FixedTeamPlan>(blank());
function blank(): FixedTeamPlan {
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    gameName: '',
    hostOpenid: '',
    startTime: '21:00',
    endTime: '23:00',
    capacity: 4,
    platform: 'Steam',
    voice: '不限',
    enabled: true,
  };
}
function edit(plan?: FixedTeamPlan) {
  Object.assign(form, { hostNickName: '', ...(plan || blank()) });
  hostKeyword.value = '';
  isNew.value = !plan;
  timePicker.value = '';
  editing.value = true;
}
async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    const [fixed, people] = await Promise.all([callTeam('adminFixedTeams'), callTeam('adminUsers')]);
    plans.value = fixed.list;
    users.value = people.list;
  } catch (error) {
    loadError.value = true;
    showError(error);
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (busy.value) return;
  if (!form.gameName.trim()) {
    toast.show('请填写游戏名称');
    return;
  }
  if (!form.hostOpenid) {
    toast.show('请选择车头');
    return;
  }
  if (form.startTime === form.endTime) {
    toast.show('开始和结束时间不能相同');
    return;
  }
  busy.value = true;
  try {
    const result = await callTeam('adminSaveFixedTeam', {
      plan: { ...form, capacity: Number(form.capacity) },
    });
    editing.value = false;
    toast.show('计划已保存');
    if (result.generationErrors.length) {
      await dialog.alert({
        title: '计划已保存，发车待重试',
        msg: result.generationErrors.map((e) => e.message).join('；'),
      });
    }
    await load();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
async function toggle(plan: FixedTeamPlan) {
  if (busy.value) return;
  try {
    await dialog.confirm({
      title: plan.enabled ? '暂停固定车？' : '启用固定车？',
      msg: plan.enabled
        ? '停止后续自动发车。当天已生成的车需要在组队管理中单独关闭。'
        : '恢复每天自动发车，当天尚未开始的车也会生成。',
    });
  } catch {
    return;
  }
  busy.value = true;
  try {
    const result = await callTeam('adminSetFixedTeamEnabled', { id: plan.id, enabled: !plan.enabled });
    toast.show('状态已更新');
    if (result.generationErrors.length)
      await dialog.alert({
        title: '状态已更新，发车待重试',
        msg: result.generationErrors.map((e) => e.message).join('；'),
      });
    await load();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <view class="fixed-teams">
    <view v-if="!editing" class="panel">
      <view class="section-title">每天固定发车</view>
      <view class="hint mt-2 mb-4">设置一次，每天自动生成一辆新车，玩家按当天车辆报名。</view>
      <wd-button block :disabled="busy || loading || loadError" @click="edit()">新增固定车</wd-button>
    </view>
    <template v-if="editing">
      <view class="editor-heading">
        <view class="section-title">{{ isNew ? '新增固定车' : '编辑固定车' }}</view>
        <view class="hint mt-1">填写发车信息，按北京时间每天重复</view>
      </view>
      <wd-form :model="form" title-width="96px" center border>
        <view class="fixed-section">
          <view class="fixed-section-heading">玩什么</view>
          <app-input
            v-model="form.gameName"
            label="游戏名称"
            placeholder="输入游戏名"
            :maxlength="40"
            clearable
            required
            hide-asterisk
          />
          <app-picker v-model="form.platform" label="游戏平台" :columns="['Steam', '手游', '端游', '主机']" />
        </view>
        <view class="fixed-section">
          <view class="fixed-section-heading">每天什么时候玩</view>
          <wd-cell
            title="开始时间"
            :value="'每天 ' + form.startTime"
            is-link
            @click="timePicker = 'startTime'"
          />
          <wd-cell
            title="结束时间"
            :value="(form.endTime < form.startTime ? '次日 ' : '当天 ') + form.endTime"
            is-link
            @click="timePicker = 'endTime'"
          />
          <view class="section-hint">{{ durationText }} · 北京时间，结束时间早于开始时间表示跨天</view>
        </view>
        <view class="fixed-section">
          <view class="fixed-section-heading">人数与语音</view>
          <wd-cell title="总人数" label="包含车头，最多20人" title-width="140px" center value-align="right">
            <view class="capacity-control"
              ><wd-input-number
                v-model="form.capacity"
                :min="2"
                :max="20"
                disable-input
                :disabled="busy"
              /><text class="capacity-unit">人</text></view
            >
          </wd-cell>
          <app-picker
            v-model="form.voice"
            label="语音方式"
            :columns="['不限', 'KOOK', '游戏内语音', '开麦']"
          />
        </view>
        <view class="fixed-section">
          <view class="fixed-section-heading">谁来当车头</view>
          <app-input v-model="hostKeyword" label="搜索车头" placeholder="输入昵称或OpenID" clearable />
          <view v-if="hostKeyword.trim() && !matchingHosts.length" class="section-hint"
            >未找到可用用户，请让车头先打开小程序填写昵称。</view
          >
          <wd-cell
            v-for="user in matchingHosts"
            :key="user._id"
            :title="user.nickName"
            :label="'OpenID：' + (user.openid || user._id)"
            value="选为车头"
            is-link
            @click="chooseHost(user)"
          />
          <view v-if="form.hostOpenid" class="host-selection">
            <view class="selected-label">已选车头 · 自动占1位</view>
            <admin-host-profile :user="selectedHost" :openid="form.hostOpenid" />
            <view class="hint mt-2">群组标识沿用车头资料，玩家可在车辆详情查看车头公开信息。</view>
          </view>
          <view v-else class="section-hint">请选择已有昵称的用户担任车头，每天自动占1位。</view>
        </view>
      </wd-form>
      <view class="fixed-preview">
        <view class="preview-caption">每天的发车安排</view>
        <view class="preview-time"
          >{{ form.startTime }} — {{ form.endTime
          }}<text v-if="form.endTime < form.startTime">（次日）</text></view
        >
        <view class="preview-detail"
          >{{ form.gameName || '待填写游戏' }} · {{ durationText }} · {{ form.capacity }}人（含车头） ·
          {{ form.voice }}</view
        >
      </view>
      <view class="hint mb-4"
        >{{
          form.enabled ? '保存后自动发车，每天零点后生成当天新车。' : '此计划已暂停，保存后仍保持暂停。'
        }}修改仅影响尚未生成的车，暂停不会取消现有车辆。</view
      >
      <view class="editor-actions">
        <wd-button block :loading="busy" @click="save">{{
          form.enabled ? '保存固定车计划' : '保存暂停的计划'
        }}</wd-button>
        <wd-button block variant="text" :disabled="busy" @click="editing = false">取消编辑</wd-button>
      </view>
    </template>
    <wd-loading v-if="loading" />
    <wd-button v-else-if="loadError" size="small" @click="load">加载失败，点击重试</wd-button>
    <wd-empty v-else-if="!editing && !plans.length" tip="还没有固定车计划" />
    <template v-if="!editing">
      <wd-card v-for="plan in plans" :key="plan.id" :title="plan.gameName" custom-class="!mx-0 !mb-4">
        <view class="plan-status"
          ><wd-tag :type="plan.enabled ? 'success' : 'info'" variant="light">{{
            plan.enabled ? '已启用' : '已暂停'
          }}</wd-tag
          ><text>{{ plan.platform }} · {{ plan.voice }}</text></view
        >
        <view class="plan-facts">
          <view
            ><text>每日开始</text><text>{{ plan.startTime }}</text></view
          >
          <view
            ><text>结束时间</text
            ><text>{{ plan.endTime < plan.startTime ? '次日 ' : '当天 ' }}{{ plan.endTime }}</text></view
          >
          <view
            ><text>总人数</text><text>{{ plan.capacity }}人（含车头）</text></view
          >
        </view>
        <view class="selected-label">车头信息</view>
        <admin-host-profile :user="hostFor(plan)" :openid="plan.hostOpenid" />
        <view class="flex gap-2 mt-4">
          <wd-button size="small" variant="soft" :disabled="busy" @click="edit(plan)">编辑计划</wd-button>
          <wd-button size="small" variant="soft" :disabled="busy" @click="toggle(plan)">{{
            plan.enabled ? '暂停发车' : '启用发车'
          }}</wd-button>
        </view>
      </wd-card>
    </template>
    <wd-datetime-picker
      root-portal
      :z-index="1200"
      :visible="!!timePicker"
      type="time"
      :title="timePicker === 'startTime' ? '每天开始时间' : '每天结束时间'"
      :model-value="timePicker === 'startTime' ? form.startTime : form.endTime"
      @update:visible="!$event && (timePicker = '')"
      @confirm="confirmTime"
    />
  </view>
</template>
<style scoped>
.editor-heading {
  margin: 8px 0 16px;
}
.fixed-section {
  overflow: hidden;
  margin-bottom: 14px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-surface);
}
.fixed-section-heading {
  padding: 16px 14px 8px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--app-ink);
}
.section-hint {
  padding: 8px 14px 14px;
  font-size: 12px;
  line-height: 20px;
  color: var(--app-secondary);
}
.capacity-control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.capacity-unit {
  font-size: 13px;
  color: var(--app-secondary);
}
.host-selection {
  padding: 6px 14px 14px;
}
.selected-label {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 20px;
  color: var(--app-secondary);
}
.fixed-preview {
  margin: 4px 0 12px;
  padding: 16px;
  border-radius: 14px;
  background: var(--app-brand-light);
  color: var(--app-brand);
}
.preview-caption {
  font-size: 12px;
  line-height: 20px;
}
.preview-time {
  margin: 4px 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.preview-time text {
  font-size: 13px;
}
.preview-detail {
  font-size: 12px;
  line-height: 21px;
  overflow-wrap: anywhere;
}
.editor-actions {
  margin-bottom: 20px;
}
.plan-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--app-secondary);
}
.plan-facts {
  margin-bottom: 16px;
}
.plan-facts > view {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  font-size: 14px;
  line-height: 22px;
}
.plan-facts > view > text:first-child {
  color: var(--app-secondary);
}
.plan-facts > view > text:last-child {
  color: var(--app-ink);
  font-weight: 500;
}
</style>
