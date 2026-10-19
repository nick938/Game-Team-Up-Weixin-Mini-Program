<script setup lang="ts">
import { appThemeStyle } from '../../design/tokens';
import { useAppTheme } from '../../composables/useAppTheme';
useAppTheme();
defineOptions({ name: 'ProbeIndexPage' });
import { ref } from 'vue';
import { dateParts } from '../../utils/format';

const target = __BUILD_TARGET__;
const room = ref('');
const showPopup = ref(false);
const date = ref('2026-10-15');
const feedback = ref('尚未验证');
const loginResult = ref('尚未验证');
const selectedImage = ref('');
const capabilities = ref('点击检测');
const healthURL = import.meta.env.VITE_P0_HEALTH_URL || '';
const healthResult = ref(healthURL ? '尚未验证' : '尚未部署并配置独立探测接口');
const checkingHealth = ref(false);

function checkHTTP() {
  if (!healthURL || checkingHealth.value) return;
  if (!healthURL.startsWith('https://') || !healthURL.endsWith('/p0/health')) {
    healthResult.value = '只接受 HTTPS 的 /p0/health 探测接口';
    return;
  }
  checkingHealth.value = true;
  uni.request({
    url: healthURL,
    method: 'GET',
    timeout: 10000,
    success(result) {
      const data = result.data as { ok?: boolean; service?: string; version?: string } | null;
      const passed =
        result.statusCode === 200 &&
        data?.ok === true &&
        data.service === 'game-team-p0' &&
        data.version === 'p0-health-v1';
      healthResult.value = passed
        ? 'HTTP 探测通过；尚未验证用户登录、数据库或跨端上车'
        : `探测未通过（HTTP ${result.statusCode}，响应标识不匹配）`;
    },
    fail() {
      healthResult.value = '请求失败，请核对部署、网关、跨域或平台合法域名配置';
    },
    complete() {
      checkingHealth.value = false;
    },
  });
}

function inspectHost() {
  try {
    const system = uni.getSystemInfoSync();
    capabilities.value = JSON.stringify(
      {
        buildTarget: target,
        platform: system.platform,
        hostName: system.hostName || null,
        SDKVersion: system.SDKVersion || null,
        loginAPI: uni.canIUse('login'),
        requestAPI: uni.canIUse('request'),
        chooseImageAPI: uni.canIUse('chooseImage'),
      },
      null,
      2,
    );
  } catch {
    capabilities.value = '宿主信息读取失败，需检查真机日志';
  }
}

function validateForm() {
  feedback.value = room.value.trim() ? '本地表单校验通过（未创建队伍）' : '请填写房间 / 加入方式';
}

function checkLogin() {
  if (target === 'h5') {
    loginResult.value = 'H5 不执行小程序登录，请使用已配置 AppID 的开发工具或真机';
    return;
  }

  loginResult.value = '正在请求宿主凭证';
  uni.login({
    success(result) {
      loginResult.value = result.code
        ? '已获得宿主 code；尚未向服务端换取业务身份'
        : '宿主回调成功但没有 code，需核对该平台登录接口';
      // 不输出、持久化或上传 code。取得 code 不代表业务登录完成。
    },
    fail() {
      loginResult.value = '宿主登录失败，请核对 AppID、账号与平台权限';
    },
  });
}

function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success(result) {
      selectedImage.value = result.tempFilePaths[0] || '';
    },
    fail() {
      feedback.value = '未选择图片或当前宿主不支持';
    },
  });
}

function changeDate(value: number) {
  date.value = dateParts(value).date;
}
</script>

<template>
  <app-shell title="接入诊断" subtitle="仅验证组件、宿主能力和登录凭证获取，不代表跨端业务已完成。">
    <wd-card title="组件与表单" custom-class="!mx-0 !mb-4"
      ><app-input v-model="room" label="加入方式" placeholder="房间号或好友代码" clearable /><view
        class="flex gap-2 flex-wrap mt-4"
        ><wd-button size="small" @click="validateForm">本地校验</wd-button
        ><wd-button size="small" variant="soft" @click="showPopup = true">打开 Wot 弹窗</wd-button
        ><wd-button size="small" variant="soft" @click="chooseImage">选择图片（不上传）</wd-button></view
      ><view class="hint my-3">{{ feedback }}</view
      ><app-datetime-picker
        type="date"
        label="日期选择"
        :model-value="new Date(date).getTime()"
        @confirm="changeDate(Number($event.value))" /><image
        v-if="selectedImage"
        :src="selectedImage"
        class="w-24 h-24 mt-4"
        mode="aspectFit"
    /></wd-card>
    <wd-card title="宿主能力" custom-class="!mx-0 !mb-4"
      ><view class="hint mb-4">编译目标：{{ target }}；目标名称不能代替实际宿主身份。</view
      ><wd-button variant="soft" @click="inspectHost">检测宿主</wd-button
      ><view class="hint mt-4">{{ capabilities }}</view></wd-card
    >
    <wd-card title="登录凭证" custom-class="!mx-0 !mb-4"
      ><view class="hint mb-4">仅获取宿主 code，不输出、不保存、不提交至服务端。</view
      ><wd-button variant="soft" @click="checkLogin">验证宿主登录</wd-button
      ><view class="hint mt-4">{{ loginResult }}</view></wd-card
    >
    <wd-card title="独立 HTTP 探测" custom-class="!mx-0 !mb-4"
      ><wd-button :disabled="!healthURL || checkingHealth" variant="soft" @click="checkHTTP"
        >验证 HTTP 链路</wd-button
      ><view class="hint mt-4">{{ healthResult }}</view></wd-card
    >
    <wd-popup :z-index="1100" v-model="showPopup" position="bottom" closable safe-area-inset-bottom
      ><view class="sheet-content" :style="appThemeStyle"
        ><view class="section-title mb-4">弹窗验证</view
        ><app-input v-model="room" placeholder="在弹窗内输入加入方式" /><view class="mt-5"
          ><wd-button block @click="showPopup = false">完成</wd-button></view
        ></view
      ></wd-popup
    >
  </app-shell>
</template>
