const { SUBSCRIBE_TMPL_ID } = require("./constants");

function requestTeamNotify() {
  const id = SUBSCRIBE_TMPL_ID;
  if (!id) return Promise.resolve(false);
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [id],
      success: (res) => resolve(res[id] === "accept"),
      fail: () => resolve(false),
    });
  });
}

module.exports = {
  requestTeamNotify,
};
