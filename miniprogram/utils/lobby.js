// 大厅列表整理：游戏筛选 + 关键词搜索 + 排序。
// 数据是分页累加来的，这里只处理已加载到本地的部分。
// 排序方式：
// latest 最新——按创建时间倒序，刚发的车在最上面（默认）
// hot 最热——按已上车人数排序，人越多越靠前
const SORT_MODES = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "最热" },
];

const DEFAULT_SORT = "latest";

function createdAtOf(team) {
  return Number((team && team.createdAt) || 0);
}

// 热度只看已上车人数；同人数按最新发布，避免顺序随机。
function heatOf(team) {
  return Number((team && team.memberCount) || 0);
}

function normalizeMode(mode) {
  return SORT_MODES.some((m) => m.key === mode) ? mode : DEFAULT_SORT;
}

function sortTeams(list, mode) {
  const arr = (list || []).slice();
  const key = normalizeMode(mode);
  if (key === "hot") {
    arr.sort(
      (a, b) => heatOf(b) - heatOf(a) || createdAtOf(b) - createdAtOf(a)
    );
  } else {
    arr.sort((a, b) => createdAtOf(b) - createdAtOf(a));
  }
  return arr;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

// 搜索：游戏名 / 区服 / 段位要求 / 备注 命中其一即可，忽略大小写和空白。
function matchKeyword(team, keyword) {
  const kw = normalizeText(keyword);
  if (!kw) return true;
  const hay = [team.gameName, team.server, team.rankReq, team.note]
    .map(normalizeText)
    .join(" ");
  return hay.indexOf(kw) >= 0;
}

function filterByGame(list, gameFilter) {
  if (!gameFilter || gameFilter === "全部") return list || [];
  return (list || []).filter((t) => t.gameName === gameFilter);
}

// 先按关键词搜索、再按游戏名筛选，最后按当前排序方式排列。
function buildLobbyView(list, { gameFilter = "全部", keyword = "", sortMode = DEFAULT_SORT } = {}) {
  const searched = (list || []).filter((t) => matchKeyword(t, keyword));
  return sortTeams(filterByGame(searched, gameFilter), sortMode);
}

module.exports = {
  SORT_MODES,
  DEFAULT_SORT,
  sortTeams,
  matchKeyword,
  filterByGame,
  buildLobbyView,
};
