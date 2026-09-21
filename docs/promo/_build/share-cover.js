// 小程序分享卡片封面（5:4，微信官方推荐比例）生成脚本。
// 微信在 onShareAppMessage/onShareTimeline 未返回 imageUrl 时回退到「页面自动截图」，
// 那条路径不可靠（详情页数据没到时整页是空背景，截出来就是一块浅灰），所以固定用这张图。
// 输出：miniprogram/images/share/cover-v1.jpg
//
// 用法：node share-cover.js   （内部调用无头 Chrome 渲染 HTML，再缩到目标尺寸）
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const buildDir = __dirname;
const outDir = path.resolve(buildDir, "../../../miniprogram/images/share");
const imgDir = path.resolve(buildDir, "../../../miniprogram/images/brand");

// 750×600 正好是 5:4。2 倍渲染后缩回来，文字边缘更干净。
const W = 750;
const H = 600;
const SCALE = 2;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONT = '"Microsoft YaHei","PingFang SC",sans-serif';

const LOBBY =
  "data:image/jpeg;base64," + fs.readFileSync(path.join(imgDir, "lobby-v1.jpg")).toString("base64");

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{font-family:${FONT};color:#202438;-webkit-font-smoothing:antialiased}
  .wrap{position:relative;width:${W}px;height:${H}px;overflow:hidden;
        display:flex;align-items:center;justify-content:space-between;padding:0 52px;
        background:linear-gradient(158deg,#F7F8FC 0%,#EEECFF 58%,#E6E3FB 100%)}
  .blob{position:absolute;border-radius:50%;filter:blur(2px);opacity:.55}
</style></head><body><div class="wrap">
  <div class="blob" style="width:340px;height:340px;background:#DCD6FF;left:-130px;top:-140px"></div>
  <div class="blob" style="width:300px;height:300px;background:#CFC7FF;right:-120px;bottom:-130px"></div>

  <div style="position:relative;width:300px">
    <div style="font-size:24px;font-weight:800;color:#8B84B8;letter-spacing:3px">开黑星球｜游戏搭子</div>
    <div style="font-size:74px;font-weight:900;line-height:1.2;margin-top:18px">找队友<br/>开一局</div>
    <div style="font-size:27px;font-weight:700;color:#6255E7;line-height:1.55;margin-top:24px">一条车丢进群<br/>点开就能上车</div>
  </div>

  <img src="${LOBBY}" style="position:relative;width:320px;display:block;border-radius:30px;
    border:2px solid #EDEAF9;box-shadow:0 18px 44px rgba(98,85,231,.18)"/>
</div></body></html>`;

const htmlPath = path.join(buildDir, "share-cover.html");
fs.writeFileSync(htmlPath, html, "utf8");

const pngPath = path.join(os.tmpdir(), "share-cover.png");
execFileSync(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=" + SCALE,
    "--screenshot=" + pngPath,
    `--window-size=${W},${H}`,
    "file://" + htmlPath,
  ],
  { stdio: "inherit" }
);

fs.mkdirSync(outDir, { recursive: true });
const jpgPath = path.join(outDir, "cover-v1.jpg");
// 小程序主包只有 2MB，封面按目标尺寸出图并压到质量 82
execFileSync(
  "/usr/bin/sips",
  ["-z", String(H), String(W), "-s", "format", "jpeg", "-s", "formatOptions", "82", pngPath, "--out", jpgPath],
  { stdio: "inherit" }
);
fs.rmSync(pngPath, { force: true });

console.log("written", jpgPath);
