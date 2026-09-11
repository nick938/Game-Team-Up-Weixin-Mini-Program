// 大厅排序方式：
// latest 最新——按创建时间倒序，刚发的车在最上面（默认）
// hot 最热——按已上车人数排序，人越多越靠前
// time 即将开始——按开打时间从近到远，已开打的车沉底
const SORT_MODES = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "最热" },
  { key: "time", label: "即将开始" },
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
  } else if (key === "time") {
    arr.sort((a, b) => {
      if (!!a.started !== !!b.started) return a.started ? 1 : -1;
      return Number((a && a.startAt) || 0) - Number((b && b.startAt) || 0);
    });
  } else {
    arr.sort((a, b) => createdAtOf(b) - createdAtOf(a));
  }
  return arr;
}

module.exports = { SORT_MODES, DEFAULT_SORT, sortTeams };
