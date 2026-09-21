// 微信在分享接口没返回 imageUrl 时，会回退到「截取当前页面」。那条路径不可靠：
// 详情页的主体挂在 wx:if="{{team}}" 上，云函数返回前整页只有背景色，截出来就是一块浅灰，
// 群里看到的卡片就是空白的。所以每个分享入口都显式带上这张 5:4 封面。
// 换图见 docs/promo/_build/share-cover.js。
const SHARE_COVER = "/images/share/cover-v1.jpg";

function plazaShare(title) {
  return {
    title: title || "开黑星球｜游戏搭子",
    path: "/pages/index/index",
    query: "",
  };
}

// 把「分享什么」和「怎么交给微信」分开：各页只管算 title/path/query，
// 封面统一在这里挂上，新增页面不会漏。第二参数可覆盖封面 —— 详情页会传自己画的
// 那张「这趟车」信息图（见 utils/team-cover.js），画不出来时传空值就用品牌图兜底。
function shareToFriend(share, imageUrl) {
  return { title: share.title, path: share.path, imageUrl: imageUrl || SHARE_COVER };
}

function shareToTimeline(share, imageUrl) {
  return { title: share.title, query: share.query, imageUrl: imageUrl || SHARE_COVER };
}

function bindCopyUrl(api, getPayload) {
  if (!api || typeof api.onCopyUrl !== "function") return;
  unbindCopyUrl(api);
  api.onCopyUrl(() => {
    const payload = typeof getPayload === "function" ? getPayload() : getPayload || {};
    return {
      query: payload.query || "",
      title: payload.title || "开黑星球",
    };
  });
}

function unbindCopyUrl(api) {
  if (api && typeof api.offCopyUrl === "function") api.offCopyUrl();
}

module.exports = {
  SHARE_COVER,
  plazaShare,
  shareToFriend,
  shareToTimeline,
  bindCopyUrl,
  unbindCopyUrl,
};
