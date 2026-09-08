// 仅合并同时发生的相同读取；完成后即清除，组队状态始终重新读取。
const pendingReads = new Map();
const READ_TYPES = new Set(["getProfile", "getPublicProfile", "getTeam", "listTeams", "myTeams"]);

function callTeam(type, data = {}) {
  if (!READ_TYPES.has(type)) return invokeTeam(type, data);
  const key = JSON.stringify([type, data]);
  if (pendingReads.has(key)) return pendingReads.get(key);
  const request = invokeTeam(type, data).finally(() => pendingReads.delete(key));
  pendingReads.set(key, request);
  return request;
}

function invokeTeam(type, data = {}) {
  return wx.cloud
    .callFunction({
      name: "team",
      data: { type, ...data },
    })
    .then((res) => {
      const result = res.result || {};
      if (!result.ok) {
        const err = new Error(result.errMsg || "请求失败");
        err.code = result.code;
        throw err;
      }
      return result;
    })
    .catch((e) => {
      const msg = e.errMsg || e.message || "";
      if (msg.includes("FunctionName") || msg.includes("function not found")) {
        throw new Error(
          "请先上传云函数 team：右键 cloudfunctions/team → 上传并部署：云端安装依赖"
        );
      }
      if (e.code) throw e;
      throw new Error(e.message || "请求失败");
    });
}

function showError(e) {
  wx.showToast({
    title: (e && e.message) || "出错了",
    icon: "none",
  });
}

module.exports = {
  callTeam,
  showError,
};
