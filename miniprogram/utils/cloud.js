function callTeam(type, data = {}) {
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
