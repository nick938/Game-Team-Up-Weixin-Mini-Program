const { SUBSCRIBE_TMPL_ID } = require("./constants");

// 必须从用户点击直接调用原生授权；不在页面加载时申请订阅。
function requestTeamNotify() {
  const id = SUBSCRIBE_TMPL_ID;
  if (!id) return Promise.resolve(false);
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [id],
      success: (res) => resolve(res[id] === "accept"),
      fail: (err) => {
        console.warn("requestSubscribeMessage failed", err.errMsg);
        resolve(false);
      },
    });
  });
}

module.exports = {
  requestTeamNotify,
};
