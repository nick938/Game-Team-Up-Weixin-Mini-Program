// 可收录的游戏落地页。发车仍可手填任意游戏名。
// slug 是内部 id，seoKey 是搜一搜 / 分享用的稳定参数，两者不一致时用映射，不改后端。
const GAME_SEO = {
  wangzhe: {
    title: "王者开黑｜王者搭子",
    heading: "王者开黑找搭子",
    description:
      "找王者搭子，一起开黑。支持单双排、五排组队，快速找到一起玩的王者队友。",
  },
  delta: {
    title: "三角洲搭子｜三角洲行动组队",
    heading: "找三角洲搭子",
    description: "三角洲行动组队找队友，快速找到一起玩的三角洲搭子。",
  },
  valorant: {
    title: "瓦搭子｜无畏契约组队",
    heading: "找瓦搭子",
    description: "无畏契约找队友，快速匹配瓦搭子，一起组队开黑。",
  },
  peace: {
    title: "和平精英搭子｜组队找队友",
    heading: "找和平精英搭子",
    description: "和平精英组队找队友，快速找到一起玩的游戏搭子。",
  },
};

const FALLBACK_SEO = {
  title: "游戏搭子｜开黑找队友",
  heading: "找游戏搭子，一起开黑",
  description:
    "王者开黑、三角洲搭子、瓦搭子、和平精英搭子，快速找到一起玩的队友。",
};

const FEATURED_SEO_KEYS = ["wangzhe", "delta", "valorant", "peace"];

const GAME_CATALOG = [
  {
    slug: "cs2",
    name: "CS2",
    platform: "Steam",
    entryLabel: "CS2开黑",
    navTitle: "CS2开黑｜找CS2搭子",
    headline: "CS2开黑找搭子",
    blurb: "找 CS2 搭子一起开黑。发一趟车写清几点打、几缺几、怎么进房，快速找到一起玩的队友。",
    aliases: ["cs2", "csgo", "cs:go", "反恐精英", "counter-strike", "counterstrike"],
    tags: ["CS2开黑", "CS2搭子", "找游戏搭子"],
  },
  {
    slug: "delta",
    seoKey: "delta",
    featured: true,
    name: "三角洲行动",
    platform: "Steam",
    entryLabel: "三角洲搭子",
    aliases: ["三角洲行动", "三角洲", "delta force", "deltaforce", "delta-force", "三角洲搭子"],
    tags: ["三角洲搭子", "三角洲行动组队", "开黑"],
  },
  {
    slug: "naraka",
    name: "永劫无间",
    platform: "Steam",
    entryLabel: "永劫开黑",
    navTitle: "永劫开黑｜永劫搭子",
    headline: "永劫开黑找搭子",
    blurb: "找永劫搭子一起开黑。三排缺人时发一趟车，写清段位和进房方式就能上车。",
    aliases: ["永劫无间", "永劫", "naraka"],
    tags: ["永劫开黑", "永劫搭子", "游戏搭子"],
  },
  {
    slug: "lol",
    name: "英雄联盟",
    platform: "端游",
    entryLabel: "LOL开黑",
    navTitle: "LOL开黑｜英雄联盟搭子",
    headline: "LOL开黑找搭子",
    blurb: "找英雄联盟搭子，双排、五排快速开黑组队。",
    aliases: ["英雄联盟", "lol", "联盟"],
    tags: ["LOL开黑", "英雄联盟搭子", "开黑"],
  },
  {
    slug: "valorant",
    seoKey: "valorant",
    featured: true,
    name: "无畏契约",
    platform: "端游",
    entryLabel: "瓦搭子",
    aliases: ["无畏契约", "valorant", "瓦罗兰特", "瓦洛兰特", "瓦搭子"],
    tags: ["瓦搭子", "无畏契约组队", "开黑"],
  },
  {
    slug: "pubg",
    seoKey: "peace",
    featured: true,
    name: "和平精英",
    platform: "手游",
    entryLabel: "和平精英搭子",
    aliases: ["和平精英", "吃鸡", "pubg", "pubgm", "peace", "和平精英搭子"],
    tags: ["和平精英搭子", "组队找队友", "开黑"],
  },
  {
    slug: "wangzhe",
    seoKey: "wangzhe",
    featured: true,
    name: "王者荣耀",
    platform: "手游",
    entryLabel: "王者开黑",
    aliases: ["王者荣耀", "王者", "农药", "王者开黑", "王者搭子"],
    tags: ["王者开黑", "王者搭子", "游戏搭子"],
  },
  {
    slug: "dota2",
    name: "DOTA2",
    platform: "Steam",
    entryLabel: "DOTA2开黑",
    navTitle: "DOTA2开黑｜刀塔搭子",
    headline: "DOTA2开黑找搭子",
    blurb: "找刀塔搭子一起开黑。五排缺人时发一趟车，写清几点打、怎么进房就能上车。",
    aliases: ["dota2", "dota 2", "刀塔"],
    tags: ["DOTA2开黑", "刀塔搭子", "开黑"],
  },
].map(applySeo);

function applySeo(game) {
  const seoKey = game.seoKey || game.slug;
  const seo = GAME_SEO[seoKey];
  if (!seo) return Object.assign({ seoKey }, game);
  return Object.assign({}, game, {
    seoKey,
    navTitle: seo.title,
    shareTitle: seo.title,
    headline: seo.heading,
    blurb: seo.description,
  });
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[:：]/g, "");
}

function gameKeys(game) {
  if (!game) return [];
  return [game.slug, game.seoKey, game.name]
    .concat(game.aliases || [])
    .map(normalizeKey)
    .filter(Boolean);
}

function findGame(query) {
  const key = normalizeKey(query);
  if (!key) return null;
  return (
    GAME_CATALOG.find((game) => gameKeys(game).some((item) => item === key)) ||
    null
  );
}

const FEATURED_GAMES = FEATURED_SEO_KEYS.map(findGame).filter(Boolean);

function teamMatchesGame(team, game) {
  const name = normalizeKey(team && team.gameName);
  if (!name || !game) return false;
  return gameKeys(game).some(
    (key) => name === key || name.indexOf(key) >= 0 || key.indexOf(name) >= 0
  );
}

function filterTeamsByGame(list, game) {
  return (list || []).filter((team) => teamMatchesGame(team, game));
}

function seoKeyOf(game) {
  return (game && (game.seoKey || game.slug)) || "";
}

function resolveGameQuery(query) {
  const options = query || {};
  return findGame(
    options.game || options.g || options.id || options.slug || options.name
  );
}

function pageSeo(game) {
  if (!game) return Object.assign({ gameKey: "" }, FALLBACK_SEO);
  return {
    gameKey: seoKeyOf(game),
    title: game.navTitle || FALLBACK_SEO.title,
    heading: game.headline || FALLBACK_SEO.heading,
    description: game.blurb || FALLBACK_SEO.description,
  };
}

function gamePath(gameOrKey) {
  const game =
    gameOrKey && typeof gameOrKey === "object"
      ? gameOrKey
      : findGame(gameOrKey);
  const key = seoKeyOf(game) || String(gameOrKey || "").trim();
  return key
    ? `/pages/game/game?game=${encodeURIComponent(key)}`
    : "/pages/game/game";
}

function gameNavTitle(game) {
  return pageSeo(game).title;
}

function gameShareTitle(game) {
  return pageSeo(game).title;
}

function gameShare(game) {
  const seo = pageSeo(game);
  const query = seo.gameKey ? `game=${encodeURIComponent(seo.gameKey)}` : "";
  return {
    title: seo.title,
    path: query ? `/pages/game/game?${query}` : "/pages/game/game",
    query,
  };
}

module.exports = {
  GAME_SEO,
  GAME_CATALOG,
  FEATURED_GAMES,
  FALLBACK_SEO,
  findGame,
  resolveGameQuery,
  teamMatchesGame,
  filterTeamsByGame,
  gamePath,
  gameNavTitle,
  gameShareTitle,
  gameShare,
  pageSeo,
};
