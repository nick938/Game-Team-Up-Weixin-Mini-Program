// 优先使用运行模式；旧基础库通过朋友圈单页场景值识别。
function isSinglePage(options) {
  let entry = options;
  if (!entry) {
    try {
      if (typeof wx.getLaunchOptionsSync === "function") entry = wx.getLaunchOptionsSync();
    } catch (e) {}
  }
  if (!entry) return false;
  if (entry.mode) return entry.mode === "singlePage";
  return Number(entry.scene) === 1154;
}

module.exports = { isSinglePage };
