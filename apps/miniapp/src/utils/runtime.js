import { platform } from "../platform/host";
// 优先使用运行模式；旧基础库通过朋友圈单页场景值识别。
function isSinglePage(options) {
  if (__BUILD_TARGET__ !== "mp-weixin") return false;
  let entry = options;
  if (!entry) {
    try {
      if (typeof platform.getLaunchOptionsSync === "function") entry = platform.getLaunchOptionsSync();
    } catch (e) {}
  }
  if (!entry) return false;
  if (entry.mode) return entry.mode === "singlePage";
  return Number(entry.scene) === 1154;
}

export { isSinglePage };
