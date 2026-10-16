// Explicit references are required by uni-app H5 API tree shaking. Aliasing the
// whole uni namespace silently drops methods used only by migrated page handlers.
export const platform = {
  canvasToTempFilePath: uni.canvasToTempFilePath,
  createSelectorQuery: uni.createSelectorQuery,
  getAccountInfoSync: uni.getAccountInfoSync,
  getEnterOptionsSync: uni.getEnterOptionsSync,
  getLaunchOptionsSync: uni.getLaunchOptionsSync,
  getStorageSync: uni.getStorageSync,
  getSystemInfoSync: uni.getSystemInfoSync,
  getWindowInfo: uni.getWindowInfo,
  hideTabBar: uni.hideTabBar,
  navigateBack: uni.navigateBack,
  navigateTo: uni.navigateTo,
  pageScrollTo: uni.pageScrollTo,
  setClipboardData: uni.setClipboardData,
  setNavigationBarTitle: uni.setNavigationBarTitle,
  setStorageSync: uni.setStorageSync,
  showTabBar: uni.showTabBar,
  stopPullDownRefresh: uni.stopPullDownRefresh,
  switchTab: uni.switchTab,
  onCopyUrl: undefined as ((callback: () => { query: string; title: string }) => void) | undefined,
  offCopyUrl: undefined as (() => void) | undefined,
};
// #ifdef MP-WEIXIN
interface CopyURLApi {
  onCopyUrl?: typeof platform.onCopyUrl;
  offCopyUrl?: typeof platform.offCopyUrl;
}
declare const wx: CopyURLApi;
platform.onCopyUrl = wx.onCopyUrl?.bind(wx);
platform.offCopyUrl = wx.offCopyUrl?.bind(wx);
// #endif
export const buildTarget = __BUILD_TARGET__;
export const capabilities = Object.freeze({
  wechatCloud: buildTarget === 'mp-weixin',
  nativeLogin: ['mp-weixin', 'mp-qq', 'mp-alipay', 'mp-toutiao'].includes(buildTarget),
  wechatSubscription: buildTarget === 'mp-weixin',
  nicknameInput: buildTarget === 'mp-weixin',
});

export function loginCode(): Promise<string> {
  if (!capabilities.nativeLogin) return Promise.reject(new Error('请在小程序中登录'));
  return new Promise((resolve, reject) =>
    uni.login({
      success(result) {
        if (result.code) resolve(result.code);
        else reject(new Error('登录未成功，请重试'));
      },
      fail() {
        reject(new Error('登录失败，请稍后重试'));
      },
    }),
  );
}

export function chooseAvatar(): Promise<string> {
  return new Promise((resolve, reject) =>
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success(result) {
        const file = result.tempFilePaths[0];
        if (file) resolve(file);
        else reject(new Error('未选择图片'));
      },
      fail() {
        reject(new Error('未选择图片'));
      },
    }),
  );
}
