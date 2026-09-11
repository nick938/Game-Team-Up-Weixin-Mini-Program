function decodeValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return decodeURIComponent(text.replace(/\+/g, " ")).trim();
  } catch (e) {
    return text;
  }
}

function usableTeamId(value) {
  const id = decodeValue(value);
  if (!id || id === "undefined" || id === "null") return "";
  return id;
}

function parseQuery(raw) {
  const text = String(raw || "").replace(/^\?/, "").trim();
  if (!text) return {};
  const out = {};
  text.split("&").forEach((pair) => {
    if (!pair) return;
    const i = pair.indexOf("=");
    const key = decodeValue(i >= 0 ? pair.slice(0, i) : pair);
    const value = decodeValue(i >= 0 ? pair.slice(i + 1) : "");
    if (key) out[key] = value;
  });
  return out;
}

function teamIdFromQuery(query) {
  if (!query || typeof query !== "object") return "";
  return usableTeamId(query.teamId || query.id || "");
}

function teamIdFromScene(scene) {
  const raw = decodeValue(scene);
  if (!raw) return "";
  if (raw.includes("=")) return teamIdFromQuery(parseQuery(raw));
  return usableTeamId(raw);
}

function resolveTeamId(options, extras) {
  const fromOptions = teamIdFromQuery(options);
  if (fromOptions) return fromOptions;
  if (options && options.scene) {
    const fromScene = teamIdFromScene(options.scene);
    if (fromScene) return fromScene;
  }
  const enterQuery = extras && extras.enter && extras.enter.query;
  const fromEnter = teamIdFromQuery(enterQuery);
  if (fromEnter) return fromEnter;
  const launchQuery = extras && extras.launch && extras.launch.query;
  return teamIdFromQuery(launchQuery);
}

function teamShareQuery(teamId) {
  const id = usableTeamId(teamId);
  return id ? `id=${encodeURIComponent(id)}` : "";
}

function teamDetailPath(teamId, extra) {
  const id = usableTeamId(teamId);
  if (!id) return "";
  const parts = [`id=${encodeURIComponent(id)}`, `teamId=${encodeURIComponent(id)}`];
  const name = extra && extra.gameName ? String(extra.gameName).trim().slice(0, 40) : "";
  if (name) parts.push(`name=${encodeURIComponent(name)}`);
  return `/pages/team/detail?${parts.join("&")}`;
}

module.exports = {
  parseQuery,
  usableTeamId,
  resolveTeamId,
  teamShareQuery,
  teamDetailPath,
};
