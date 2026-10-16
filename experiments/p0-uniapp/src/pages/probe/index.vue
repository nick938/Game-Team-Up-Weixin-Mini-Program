<script setup lang="ts">
import { ref } from 'vue';

const target = __P0_BUILD_TARGET__;
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
      const passed = result.statusCode === 200 && data?.ok === true
        && data.service === 'game-team-p0' && data.version === 'p0-health-v1';
      healthResult.value = passed
        ? 'HTTP 探测通过；尚未验证用户登录、数据库或跨端上车'
        : `探测未通过（HTTP ${result.statusCode}，响应标识不匹配）`;
    },
    fail() { healthResult.value = '请求失败，请核对部署、网关、跨域或平台合法域名配置'; },
    complete() { checkingHealth.value = false; },
  });
}

function inspectHost() {
  try {
    const system = uni.getSystemInfoSync();
    capabilities.value = JSON.stringify({
      buildTarget: target,
      platform: system.platform,
      hostName: system.hostName || null,
      SDKVersion: system.SDKVersion || null,
      loginAPI: uni.canIUse('login'),
      requestAPI: uni.canIUse('request'),
      chooseImageAPI: uni.canIUse('chooseImage'),
    }, null, 2);
  } catch {
    capabilities.value = '宿主信息读取失败，需检查真机日志';
  }
}

function validateForm() {
  feedback.value = room.value.trim() ? '本地表单校验通过（未创建队伍）' : '请填写房间 / 加入方式';
}

function checkLogin() {
  // #ifdef H5
  loginResult.value = 'H5 不执行小程序登录，请使用已配置 AppID 的开发工具或真机';
  return;
  // #endif
  // #ifndef H5
  loginResult.value = '正在请求宿主凭证';
  uni.login({
    success(result) {
      loginResult.value = result.code
        ? '已获得宿主 code；尚未向服务端换取业务身份'
        : '宿主回调成功但没有 code，需核对该平台登录接口';
      // 不输出、持久化或上传 code。取得 code 不代表业务登录完成。
    },
    fail() { loginResult.value = '宿主登录失败，请核对 AppID、账号与平台权限'; },
  });
  // #endif
}

function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success(result) {
      selectedImage.value = result.tempFilePaths[0] || '';
    },
    fail() { feedback.value = '未选择图片或当前宿主不支持'; },
  });
}

function changeDate(event: { detail: { value: string } }) {
  date.value = event.detail.value;
}
</script>

<template>
  <view class="page">
    <text class="title">开黑星球 · P0 验证</text>
    <text class="intro">隔离实验，不连接生产环境。这里只验证组件、宿主能力和登录凭证获取，尚未完成跨端业务联调。</text>

    <view class="card">
      <text class="section-title">1. 组件与表单</text>
      <wd-input v-model="room" label="加入方式" placeholder="输入房间号或好友代码" clearable />
      <view class="actions"><wd-button @click="validateForm">本地校验</wd-button></view>
      <text class="result">{{ feedback }}</text>
      <picker mode="date" :value="date" @change="changeDate">
        <view class="date">日期选择：{{ date }}（点击修改）</view>
      </picker>
      <view class="actions"><wd-button plain @click="showPopup = true">打开 Wot 弹窗</wd-button></view>
      <view class="actions"><wd-button plain @click="chooseImage">选择图片（不上传）</wd-button></view>
      <image v-if="selectedImage" :src="selectedImage" class="preview" mode="aspectFit" />
    </view>

    <view class="card">
      <text class="section-title">2. 宿主能力</text>
      <text class="result">编译目标：{{ target }}；目标名称不能代替实际宿主身份。</text>
      <view class="actions"><wd-button plain @click="inspectHost">检测宿主</wd-button></view>
      <text class="result">{{ capabilities }}</text>
    </view>

    <view class="card">
      <text class="section-title">3. 登录凭证</text>
      <text class="intro">调用当前编译目标的登录 API。QQ 内运行微信小程序的认证方式，仍需按官方接入方案单独验证。</text>
      <view class="actions"><wd-button plain @click="checkLogin">验证宿主登录</wd-button></view>
      <text class="result">{{ loginResult }}</text>
    </view>

    <view class="card">
      <text class="section-title">4. 独立 HTTP 探测</text>
      <text class="intro">仅访问只读探测函数，不发送用户身份、登录 code 或业务数据。</text>
      <view class="actions"><wd-button :disabled="!healthURL || checkingHealth" plain @click="checkHTTP">验证 HTTP 链路</wd-button></view>
      <text class="result">{{ healthResult }}</text>
    </view>

    <view class="card">
      <text class="section-title">5. 真实业务联调：待接入</text>
      <text class="intro">当前未配置测试 API、平台身份校验和测试数据，因此不提供假登录、模拟大厅或模拟上车成功。环境与账号确认后继续。</text>
    </view>

    <wd-popup v-model="showPopup" position="bottom" closable safe-area-inset-bottom>
      <view class="popup-content">
        <text class="section-title">弹窗验证</text>
        <text class="intro">检查关闭按钮、底部安全区、滚动和键盘遮挡。</text>
        <wd-input v-model="room" placeholder="在弹窗内输入加入方式" />
        <view class="actions"><wd-button @click="showPopup = false">完成</wd-button></view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped>
.page { max-width: 900rpx; margin: 0 auto; padding: 32rpx 24rpx 64rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; margin-bottom: 16rpx; }
.intro { display: block; color: #606579; line-height: 1.7; }
.card { margin-top: 24rpx; padding: 28rpx; background: white; border-radius: 20rpx; }
.section-title { display: block; font-size: 32rpx; font-weight: 600; margin-bottom: 20rpx; }
.actions { margin-top: 20rpx; }
.result { display: block; margin-top: 20rpx; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.date { margin-top: 24rpx; padding: 24rpx 0; border-top: 1px solid #eceef5; }
.preview { display: block; width: 160rpx; height: 160rpx; margin-top: 24rpx; }
.popup-content { padding: 56rpx 32rpx 40rpx; }
</style>
