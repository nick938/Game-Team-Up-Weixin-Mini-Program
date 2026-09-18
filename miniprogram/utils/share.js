function plazaShare(title) {
  return {
    title: title || "游戏搭子｜开黑找队友",
    path: "/pages/index/index",
    query: "",
  };
}

function bindCopyUrl(api, getPayload) {
  if (!api || typeof api.onCopyUrl !== "function") return;
  unbindCopyUrl(api);
  api.onCopyUrl(() => {
    const payload = typeof getPayload === "function" ? getPayload() : getPayload || {};
    return {
      query: payload.query || "",
      title: payload.title || "图一乐",
    };
  });
}

function unbindCopyUrl(api) {
  if (api && typeof api.offCopyUrl === "function") api.offCopyUrl();
}

module.exports = {
  plazaShare,
  bindCopyUrl,
  unbindCopyUrl,
};
