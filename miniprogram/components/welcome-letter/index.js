const STORAGE_KEY = "welcomeLetterV2";

function hasReadLetter() {
  try {
    return !!wx.getStorageSync(STORAGE_KEY);
  } catch (e) {
    return false;
  }
}

function markLetterRead() {
  try {
    wx.setStorageSync(STORAGE_KEY, 1);
  } catch (e) {
    // 写不进去也先收起，避免挡住这次使用
  }
}

function setTabBarHidden(hidden) {
  if (hidden) {
    wx.hideTabBar({ animation: false, fail() {} });
  } else {
    wx.showTabBar({ animation: false, fail() {} });
  }
}

Component({
  data: {
    show: false,
  },

  lifetimes: {
    attached() {
      this.syncVisibility();
    },
  },

  pageLifetimes: {
    show() {
      this.syncVisibility();
    },
  },

  methods: {
    noop() {},

    syncVisibility() {
      const show = !hasReadLetter();
      this.setData({ show });
      setTabBarHidden(show);
    },

    dismiss() {
      markLetterRead();
      this.setData({ show: false });
      setTabBarHidden(false);
    },

    openRules() {
      this.dismiss();
      wx.navigateTo({ url: "/pages/legal/legal?type=community" });
    },

    openFeedback() {
      this.dismiss();
      wx.navigateTo({ url: "/pages/feedback/feedback" });
    },
  },
});
