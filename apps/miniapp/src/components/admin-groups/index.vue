<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { callTeam } from '../../api/team';
import type { GroupOption } from '../../types/domain';
import { applyGroupCatalog } from '../../utils/profile-options';
import { usePageFeedback } from '../../composables/usePageFeedback';
defineOptions({ name: 'AdminGroups' });
const { toast, dialog, showError } = usePageFeedback();
const groups = ref<GroupOption[]>([]);
const revision = ref(0);
const loading = ref(true);
const failed = ref(false);
const busy = ref(false);
const editing = ref(false);
const form = reactive({ value: '', label: '', enabled: true });
async function load() {
  loading.value = true;
  failed.value = false;
  try {
    const result = await callTeam('adminGroups');
    groups.value = result.groups;
    revision.value = result.revision;
    applyGroupCatalog(result);
  } catch (error) {
    failed.value = true;
    showError(error);
  } finally {
    loading.value = false;
  }
}
function edit(group?: GroupOption) {
  Object.assign(form, group || { value: '', label: '', enabled: true });
  editing.value = true;
}
async function save(group: GroupOption) {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await callTeam('adminSaveGroup', { group: { ...group, revision: revision.value } });
    groups.value = result.groups;
    revision.value = result.revision;
    applyGroupCatalog(result);
    editing.value = false;
    toast.success('已保存');
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}
async function submit() {
  if (!form.label.trim()) {
    toast.show('请填写群组名称');
    return;
  }
  await save({
    ...form,
    value: form.value || `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  });
}
async function toggle(group: GroupOption) {
  try {
    await dialog.confirm({
      title: group.enabled ? '停用群组？' : '启用群组？',
      msg: group.enabled ? '停用后不能新选入个人资料，已有标识仍会展示。' : '启用后用户可在个人资料中选择。',
    });
  } catch {
    return;
  }
  await save({ ...group, enabled: !group.enabled });
}
onMounted(load);
</script>
<template>
  <view>
    <view class="hint mb-4">群组是公开标签，不限制跨群上车。改名会更新所有展示名称；停用保留已有标识。</view>
    <wd-loading v-if="loading" />
    <wd-button v-else-if="failed" variant="soft" @click="load">重新加载</wd-button>
    <template v-else>
      <view class="flex gap-2 mb-4">
        <wd-button :disabled="busy || editing" size="small" @click="edit()">新增群组</wd-button>
        <wd-button :disabled="busy || editing" size="small" variant="soft" @click="load">刷新</wd-button>
      </view>
      <wd-card v-if="editing" :title="form.value ? '修改群组名称' : '新增群组'" custom-class="!mx-0 !mb-4">
        <wd-input
          v-model="form.label"
          label="群组名称"
          :maxlength="40"
          :disabled="busy"
          placeholder="请输入群组名称"
        />
        <view class="flex gap-2 mt-4">
          <wd-button size="small" :loading="busy" @click="submit">保存</wd-button>
          <wd-button size="small" variant="soft" :disabled="busy" @click="editing = false">取消</wd-button>
        </view>
      </wd-card>
      <wd-card v-for="group in groups" :key="group.value" :title="group.label" custom-class="!mx-0 !mb-4">
        <view class="hint mb-3">{{ group.enabled ? '已启用' : '已停用' }}</view>
        <view class="flex gap-2">
          <wd-button size="small" variant="soft" :disabled="busy || editing" @click="edit(group)"
            >改名</wd-button
          >
          <wd-button size="small" variant="soft" :disabled="busy || editing" @click="toggle(group)">{{
            group.enabled ? '停用' : '启用'
          }}</wd-button>
        </view>
      </wd-card>
      <wd-empty v-if="!groups.length" tip="暂无群组，点击新增群组" />
    </template>
  </view>
</template>
