const { APP_VERSION } = require("./constants");

const ENV_LABEL = {
  develop: "开发版",
  trial: "体验版",
  release: "正式版",
};

// 版本号以代码里的 APP_VERSION 为准，所有环境显示同一个值，避免开发版和正式版对不上。
// 只从微信取运行环境（开发版/体验版/正式版）用于标注，不再采用后台的上传版本号。
function getAppVersion() {
  let envVersion = "develop";
  try {
    const mp = (wx.getAccountInfoSync() || {}).miniProgram || {};
    envVersion = mp.envVersion || "develop";
  } catch (e) {
    // 开发工具以外的环境可能没有该 API
  }
  const version = APP_VERSION;
  const envLabel = ENV_LABEL[envVersion] || envVersion;
  const text = `v${version} · ${envLabel}`;
  return { version, envVersion, envLabel, text };
}

module.exports = { getAppVersion, ENV_LABEL };
