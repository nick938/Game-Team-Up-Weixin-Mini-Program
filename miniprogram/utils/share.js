function plazaShare(title) {
  return {
    title: title || "来开黑 - 一起组队开黑",
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
      title: payload.title || "来开黑",
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
