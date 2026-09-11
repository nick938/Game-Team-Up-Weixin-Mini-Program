const { APP_VERSION } = require("./constants");

const ENV_LABEL = {
  develop: "开发版",
  trial: "体验版",
  release: "正式版",
};

// 版本号按运行环境取值：正式版用微信后台上传的版本号，开发版/体验版用代码里的 APP_VERSION。
// 两者本来就允许不同——正式版反映线上实际发布的包，开发版反映本地代码。
// 开发版/体验版带「开发版 / 体验版」标注，正式版只显示版本号本身。
function getAppVersion() {
  let envVersion = "develop";
  let released = "";
  try {
    const mp = (wx.getAccountInfoSync() || {}).miniProgram || {};
    envVersion = mp.envVersion || "develop";
    // mp.version 只在正式版有值，开发版/体验版为空字符串。
    released = mp.version || "";
  } catch (e) {
    // 开发工具以外的环境可能没有该 API
  }
  const version = released || APP_VERSION;
  const envLabel = ENV_LABEL[envVersion] || envVersion;
  const text =
    envVersion === "release" && released
      ? `v${version}`
      : `v${version} · ${envLabel}`;
  return { version, envVersion, envLabel, text };
}

module.exports = { getAppVersion, ENV_LABEL };
