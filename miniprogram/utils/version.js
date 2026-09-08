const { APP_VERSION } = require("./constants");

const ENV_LABEL = {
  develop: "开发版",
  trial: "体验版",
  release: "正式版",
};

function getAppVersion() {
  let envVersion = "develop";
  let released = "";
  try {
    const mp = (wx.getAccountInfoSync() || {}).miniProgram || {};
    envVersion = mp.envVersion || "develop";
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
