// 分享卡片的封面：把这一趟车的信息画成 5:4 的图。
//
// 为什么不直接用微信的「页面截图」：那条路不可靠 —— 详情页主体挂在 wx:if="{{team}}" 上，
// 云函数返回前整页只剩背景色，截出来是空白卡片。但封面又必须带上「谁、几点、还差几人」，
// 所以这里自己画：内容取自详情页首屏 hero 卡片，配色也照抄它，卡片和图看起来是一套。
const { formatStartAt } = require("./format");
const { STATUS_TEXT } = require("./constants");

// 与 detail.wxss 的 .hero / .status / .count / .tags 保持一致
const COLORS = {
  bgFrom: "#e6e1ff",
  bgMid: "#f3f1ff",
  bgTo: "#ffffff",
  blob: "rgba(98, 85, 231, 0.08)",
  blobMint: "rgba(123, 224, 192, 0.14)",
  text: "#202438",
  sub: "#535b72",
  accent: "#6255e7",
  tagBg: "#f1f2f9",
  tagText: "#697188",
  fullBg: "#e9f7f3",
  fullText: "#21876f",
  idleBg: "#f0f1f6",
  idleText: "#777e92",
};

// 画布逻辑尺寸，5:4。节点 CSS 宽固定 375 —— 正好等于设计稿的 750rpx，所以 rpx 值除以 2 就是这里的 px。
const WIDTH = 375;
const HEIGHT = 300;
const PAD = 24;

const FONT_FAMILY = '-apple-system, "PingFang SC", sans-serif';

function font(size, weight) {
  return `${weight ? weight + " " : ""}${size}px ${FONT_FAMILY}`;
}

// 封面要画的文案。抽成纯函数，方便单测；画布只负责把这份数据摆上去。
function coverContent(team) {
  if (!team) return null;
  const status = team.displayStatus || team.status || "";
  const capacity = Number(team.capacity) || 0;
  const memberCount = Number(team.memberCount) || 0;

  let needText = "";
  if (status === "recruiting" && team.needCount) {
    needText = `还差 ${team.needCount} 人`;
  }

  const tags = [team.platform, team.server, team.voice, team.rankReq].filter(
    (tag) => tag && tag !== "不限"
  );

  return {
    status,
    statusText: STATUS_TEXT[status] || "",
    gameName: String(team.gameName || "开黑"),
    timeText: formatStartAt(team.startAt),
    countText: capacity ? `${memberCount}/${capacity}` : `${memberCount} 人`,
    needText,
    tags,
  };
}

// CJK 逐字断行，拉丁字母/数字按词断行，避免把 "Counter-Strike" 从中间劈开。
function tokenize(text) {
  const tokens = [];
  let latin = "";
  for (const ch of String(text)) {
    if (/[A-Za-z0-9'’\-.]/.test(ch)) {
      latin += ch;
      continue;
    }
    if (latin) {
      tokens.push(latin);
      latin = "";
    }
    if (ch === " " || ch === "\n") {
      tokens.push(" ");
    } else {
      tokens.push(ch);
    }
  }
  if (latin) tokens.push(latin);
  return tokens;
}

function measureTokens(ctx, tokens) {
  return ctx.measureText(tokens.join("")).width;
}

// 折成两行时把长度配平，否则贪心填充会留下「房车（我们到了吗?」+「）」这种孤字行。
// 找不到两边都不超宽的分法就返回 null，交给贪心那条路（带省略号）。
function balanceTwoLines(ctx, tokens, maxWidth) {
  let best = null;
  for (let split = 1; split < tokens.length; split += 1) {
    const head = tokens.slice(0, split);
    const tail = tokens.slice(split);
    const headText = head.join("").trimEnd();
    const tailText = tail.join("").trimStart();
    if (!headText || !tailText) continue;
    const headW = ctx.measureText(headText).width;
    const tailW = ctx.measureText(tailText).width;
    if (headW > maxWidth || tailW > maxWidth) continue;
    const diff = Math.abs(headW - tailW);
    if (!best || diff < best.diff) best = { lines: [headText, tailText], diff };
  }
  return best ? best.lines : null;
}

function greedyWrap(ctx, tokens, maxWidth, maxLines) {
  const lines = [];
  let line = "";
  let truncated = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const candidate = line + token;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line.trimEnd());
      line = token === " " ? "" : token;
      if (lines.length === maxLines) {
        // 没有下一行的位置了，剩下的内容用省略号收尾
        truncated = line.trim() !== "" || i < tokens.length - 1;
        break;
      }
      continue;
    }
    line = candidate;
  }
  if (!truncated && line.trim() && lines.length < maxLines) lines.push(line.trimEnd());

  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

// 最多 maxLines 行。一行放得下就不折；要折两行就配平；再多就贪心加省略号。
function wrapText(ctx, text, maxWidth, maxLines) {
  const trimmed = String(text).trim();
  if (!trimmed) return [];
  const tokens = tokenize(trimmed);
  if (measureTokens(ctx, tokens) <= maxWidth) return [trimmed];

  if (maxLines >= 2) {
    const balanced = balanceTwoLines(ctx, tokens, maxWidth);
    if (balanced) return balanced;
  }
  return greedyWrap(ctx, tokens, maxWidth, maxLines);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// 状态胶囊的颜色：招募中用主色，满员用薄荷绿，散局/结束用灰。
function pillStyle(status) {
  if (status === "recruiting") return { bg: COLORS.accent, text: "#ffffff" };
  if (status === "full") return { bg: COLORS.fullBg, text: COLORS.fullText };
  return { bg: COLORS.idleBg, text: COLORS.idleText };
}

const PILL_H = 26;
const PILL_FONT = 15;
const GAME_FONT = 36;
const GAME_LINE = 44;
const TIME_FONT = 18;
const COUNT_FONT = 27;
const NEED_FONT = 17;
const TAG_FONT = 15;
const TAG_H = 28;

// 把内容画到 ctx 上。ctx 已经按 dpr 缩放好，这里只用逻辑坐标（WIDTH × HEIGHT）。
function paintCover(ctx, content, width, height) {
  const w = width || WIDTH;
  const h = height || HEIGHT;
  const inner = w - PAD * 2;

  const bg = ctx.createLinearGradient(0, 0, w * 0.85, h);
  bg.addColorStop(0, COLORS.bgFrom);
  bg.addColorStop(0.55, COLORS.bgMid);
  bg.addColorStop(1, COLORS.bgTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 两个色块，和推广图那套视觉语言一致；也避免封面在大群里看像一张白纸
  ctx.beginPath();
  ctx.arc(w * 0.9, h * 0.08, w * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.blob;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.06, h * 0.98, w * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.blobMint;
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // 先量高度，再整体垂直居中：游戏名一行还是两行都不会头重脚轻。
  ctx.font = font(GAME_FONT, "bold");
  const gameLines = wrapText(ctx, content.gameName, inner, 2);
  const pill = pillStyle(content.status);
  ctx.font = font(PILL_FONT, "bold");
  const pillW = content.statusText
    ? Math.min(inner, ctx.measureText(content.statusText).width + 20)
    : 0;

  const blockH =
    (pillW ? PILL_H + 14 : 0) +
    gameLines.length * GAME_LINE +
    TIME_FONT * 1.4 +
    COUNT_FONT * 1.3 +
    (content.tags.length ? 12 + TAG_H : 0);
  let y = Math.max(PAD, (h - blockH) / 2);

  if (pillW) {
    roundRect(ctx, PAD, y, pillW, PILL_H, 7);
    ctx.fillStyle = pill.bg;
    ctx.fill();
    ctx.fillStyle = pill.text;
    ctx.textAlign = "center";
    ctx.fillText(content.statusText, PAD + pillW / 2, y + PILL_H / 2 + 0.5);
    ctx.textAlign = "left";
    y += PILL_H + 14;
  }

  ctx.font = font(GAME_FONT, "bold");
  ctx.fillStyle = COLORS.text;
  gameLines.forEach((line, i) => {
    ctx.fillText(line, PAD, y + GAME_LINE * i + GAME_LINE / 2);
  });
  y += gameLines.length * GAME_LINE;

  ctx.font = font(TIME_FONT);
  ctx.fillStyle = COLORS.sub;
  ctx.fillText(content.timeText, PAD, y + TIME_FONT * 0.7);
  y += TIME_FONT * 1.4;

  // 人数：大号加粗，紧跟一个主色的「还差 N 人」
  ctx.font = font(COUNT_FONT, "bold");
  ctx.fillStyle = COLORS.text;
  ctx.fillText(content.countText, PAD, y + COUNT_FONT * 0.65);
  if (content.needText) {
    const offset = ctx.measureText(content.countText).width + 10;
    ctx.font = font(NEED_FONT, "bold");
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(content.needText, PAD + offset, y + COUNT_FONT * 0.65);
  }
  y += COUNT_FONT * 1.3;

  if (content.tags.length) {
    y += 12;
    ctx.font = font(TAG_FONT);
    let x = PAD;
    for (const tag of content.tags) {
      const tagW = ctx.measureText(tag).width + 18;
      if (x + tagW > PAD + inner) break;
      roundRect(ctx, x, y, tagW, TAG_H, 6);
      ctx.fillStyle = COLORS.tagBg;
      ctx.fill();
      ctx.fillStyle = COLORS.tagText;
      ctx.textAlign = "center";
      ctx.fillText(tag, x + tagW / 2, y + TAG_H / 2 + 0.5);
      ctx.textAlign = "left";
      x += tagW + 8;
    }
  }
}

// 画到真实 canvas 节点上并导出成临时文件，供 onShareAppMessage 的 imageUrl 使用。
// 任何一步失败都 reject，交给调用方回退到静态封面 —— 不能让卡片变空白。
function renderTeamCover(canvas, team, dpr) {
  const content = coverContent(team);
  if (!content) return Promise.reject(new Error("no team to draw"));
  if (!canvas || typeof canvas.getContext !== "function") {
    return Promise.reject(new Error("no canvas"));
  }
  const ratio = dpr > 0 ? dpr : 1;
  canvas.width = WIDTH * ratio;
  canvas.height = HEIGHT * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  paintCover(ctx, content, WIDTH, HEIGHT);

  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      fileType: "jpg",
      quality: 0.9,
      success: (res) => resolve(res.tempFilePath),
      fail: reject,
    });
  });
}

module.exports = {
  WIDTH,
  HEIGHT,
  coverContent,
  wrapText,
  paintCover,
  renderTeamCover,
};
