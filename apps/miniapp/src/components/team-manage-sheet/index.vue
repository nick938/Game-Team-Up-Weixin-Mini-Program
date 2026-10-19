<script setup lang="ts">
defineOptions({ name: 'TeamManageSheet' });
defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: []; action: [action: string] }>();
</script>
<template>
  <wd-popup
    :z-index="1100"
    :model-value="show"
    position="bottom"
    round
    safe-area-inset-bottom
    closable
    @update:model-value="!$event && emit('close')"
  >
    <view class="sheet-content"
      ><view class="section-title mb-5">管理组队</view
      ><view class="flex flex-col gap-3"
        ><wd-button block variant="soft" @click="emit('action', 'edit')">编辑组队</wd-button
        ><wd-button block type="danger" variant="soft" @click="emit('action', 'cancel')">散了这趟车</wd-button
        ><wd-button block variant="text" @click="emit('close')">取消</wd-button></view
      ></view
    >
  </wd-popup>
</template>
