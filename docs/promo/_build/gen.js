// 推广配图生成：把品牌素材内联进 HTML，再用无头 Edge 截图成 PNG。
// 仅用于生成 docs/promo 下的推广图，不属于小程序运行时代码。
const fs = require("fs");
const path = require("path");

const BRAND = "开黑星球｜游戏搭子";
const buildDir = __dirname;
const outDir = path.resolve(buildDir, "..");
const imgDir = path.resolve(buildDir, "../../../miniprogram/images/brand");

function dataUri(file) {
  const b = fs.readFileSync(path.join(imgDir, file));
  return "data:image/jpeg;base64," + b.toString("base64");
}

const AVATAR = dataUri("avatar-v1.jpg");
const LOBBY = dataUri("lobby-v1.jpg");

const FONT = '"Microsoft YaHei","PingFang SC",sans-serif';

function page(w, h, body) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:${FONT};color:#202438;-webkit-font-smoothing:antialiased}
  .wrap{position:relative;width:${w}px;height:${h}px;overflow:hidden;
        background:linear-gradient(158deg,#F7F8FC 0%,#EEECFF 58%,#E6E3FB 100%)}
  .violet{background:linear-gradient(158deg,#6E62EC 0%,#6255E7 46%,#4E42C4 100%)}
  .blob{position:absolute;border-radius:50%;filter:blur(2px);opacity:.55}
  .chips{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
  .chip{background:#fff;border:2px solid #E4E1F7;color:#5549C7;font-weight:700;
        border-radius:999px;padding:16px 30px;font-size:30px;box-shadow:0 6px 18px rgba(98,85,231,.10)}
  .chip.on{background:#6255E7;border-color:#6255E7;color:#fff}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function write(name, html) {
  fs.writeFileSync(path.join(buildDir, name), html, "utf8");
}

// ---- 小红书封面 1242×1656 ----
write(
  "xhs-cover.html",
  page(
    1242,
    1656,
    `
  <div class="blob" style="width:520px;height:520px;background:#DCD6FF;left:-160px;top:-150px"></div>
  <div class="blob" style="width:420px;height:420px;background:#CFC7FF;right:-130px;bottom:120px"></div>
  <div style="position:absolute;left:0;right:0;top:96px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:14px;background:rgba(255,255,255,.9);
      border:2px solid #E4E1F7;border-radius:999px;padding:16px 34px;
      font-size:32px;font-weight:700;color:#5549C7;box-shadow:0 8px 24px rgba(98,85,231,.12)">
      <span style="width:14px;height:14px;border-radius:50%;background:#6255E7"></span>${BRAND}
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;top:270px;text-align:center;line-height:1.16">
    <div style="font-size:126px;font-weight:900;letter-spacing:2px">开黑凑不齐人？</div>
    <div style="font-size:64px;font-weight:800;color:#6255E7;margin-top:22px">我做了个发车板</div>
  </div>
  <div style="position:absolute;left:50%;top:700px;transform:translateX(-50%);
    width:600px;height:600px;border-radius:50%;
    background:radial-gradient(circle at 50% 42%,#fff 0%,#EDEAFF 62%,#DED8FF 100%);
    box-shadow:0 30px 70px rgba(98,85,231,.22);display:flex;align-items:center;justify-content:center">
    <img src="${AVATAR}" style="width:470px;height:470px;border-radius:120px;display:block"/>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:104px" class="chips">
    <div class="chip on">不用下载</div>
    <div class="chip">不用注册</div>
    <div class="chip">点卡片上车</div>
  </div>
`
  )
);

// ---- 小红书内页1：痛点 1242×1656 ----
const pains = [
  ["喊了半天，没人应", "群里喊一句「还缺两个」，两分钟后被段子和表情包刷走"],
  ["信息对不上", "房间号、人数、时间写在三条消息里，谁也看不明白"],
  ["一个个私聊回", "有人想上车，还得挨个问「还缺吗」「几点」「房间号多少」"],
  ["等着等着就散了", "等把消息回完，人早就去打别的了"],
];
write(
  "xhs-page1.html",
  page(
    1242,
    1656,
    `
  <div class="blob" style="width:460px;height:460px;background:#DCD6FF;right:-150px;top:-140px"></div>
  <div style="position:absolute;left:88px;right:88px;top:110px">
    <div style="font-size:34px;font-weight:800;color:#8B84B8;letter-spacing:4px">OPEN BLACK · 真实日常</div>
    <div style="font-size:100px;font-weight:900;margin-top:26px">说的是不是你？</div>
    <div style="margin-top:66px;display:flex;flex-direction:column;gap:34px">
      ${pains
        .map(
          (p, i) => `
      <div style="background:#fff;border-radius:38px;padding:44px 46px;display:flex;gap:32px;align-items:flex-start;
        box-shadow:0 16px 40px rgba(98,85,231,.10);border:2px solid #F0EEFB">
        <div style="flex:0 0 78px;height:78px;border-radius:26px;background:#FFF0F2;color:#C54D69;
          font-size:44px;font-weight:900;display:flex;align-items:center;justify-content:center">${i + 1}</div>
        <div>
          <div style="font-size:52px;font-weight:800;line-height:1.25">${p[0]}</div>
          <div style="font-size:34px;color:#777E92;line-height:1.5;margin-top:14px">${p[1]}</div>
        </div>
      </div>`
        )
        .join("")}
    </div>
    <div style="text-align:center;margin-top:60px;font-size:32px;font-weight:700;color:#8B84B8">
      这些，本来都不该是问题 →
    </div>
  </div>
`
  )
);

// ---- 小红书内页2：它怎么用 1242×1656 ----
const steps = [
  ["发车", "选游戏、平台、开始结束时间、几缺几、怎么进房"],
  ["丢卡片", "一条车生成一张卡片，发到群里或好友"],
  ["上车", "点开看还差几人、几点开、怎么进房，点一下就加入"],
  ["开打", "人齐自动满员，开打前 10 分钟提醒你，不怕鸽"],
];
write(
  "xhs-page2.html",
  page(
    1242,
    1656,
    `
  <div class="blob" style="width:430px;height:430px;background:#CFC7FF;left:-150px;bottom:-120px"></div>
  <div style="position:absolute;left:88px;right:88px;top:118px">
    <div style="font-size:34px;font-weight:800;color:#8B84B8;letter-spacing:4px">HOW IT WORKS</div>
    <div style="font-size:100px;font-weight:900;margin-top:26px">四步，组好一局</div>
    <div style="margin-top:70px;display:flex;flex-direction:column;gap:30px">
      ${steps
        .map(
          (s, i) => `
      <div style="background:#fff;border-radius:38px;padding:42px 46px;display:flex;gap:34px;align-items:center;
        box-shadow:0 16px 40px rgba(98,85,231,.10);border:2px solid #F0EEFB">
        <div style="flex:0 0 96px;height:96px;border-radius:30px;
          background:linear-gradient(150deg,#7A6EF0,#5549C7);color:#fff;font-size:48px;font-weight:900;
          display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(98,85,231,.28)">${i + 1}</div>
        <div>
          <div style="font-size:54px;font-weight:900;line-height:1.2">${s[0]}</div>
          <div style="font-size:33px;color:#777E92;line-height:1.5;margin-top:12px">${s[1]}</div>
        </div>
      </div>`
        )
        .join("")}
    </div>
    <div style="text-align:center;margin-top:56px;font-size:34px;font-weight:800;color:#5549C7">
      ${BRAND}
    </div>
  </div>
`
  )
);

// ---- 朋友圈主图 1080×1080 ----
write(
  "moments.html",
  page(
    1080,
    1080,
    `
  <div class="blob" style="width:460px;height:460px;background:#7C6FF0;left:-140px;top:-150px;opacity:.7"></div>
  <div class="blob" style="width:520px;height:520px;background:#4E42C4;right:-170px;bottom:-160px;opacity:.8"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(158deg,#6E62EC 0%,#6255E7 46%,#4E42C4 100%)"></div>
  <div style="position:absolute;left:0;right:0;top:92px;text-align:center;color:#fff">
    <div style="font-size:40px;font-weight:800;letter-spacing:6px;opacity:.85">${BRAND}</div>
  </div>
  <div style="position:absolute;left:50%;top:210px;transform:translateX(-50%);
    width:430px;height:430px;border-radius:50%;background:rgba(255,255,255,.12);
    display:flex;align-items:center;justify-content:center;border:3px solid rgba(255,255,255,.25)">
    <img src="${AVATAR}" style="width:340px;height:340px;border-radius:96px;display:block"/>
  </div>
  <div style="position:absolute;left:0;right:0;top:690px;text-align:center;color:#fff">
    <div style="font-size:76px;font-weight:900;letter-spacing:2px">微信里的开黑发车板</div>
    <div style="font-size:40px;font-weight:600;opacity:.92;margin-top:26px">一条车丢进群，点开就能上车</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:76px" class="chips">
    <div style="background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.34);color:#fff;
      border-radius:999px;padding:16px 32px;font-size:30px;font-weight:700">不用下载</div>
    <div style="background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.34);color:#fff;
      border-radius:999px;padding:16px 32px;font-size:30px;font-weight:700">不用注册</div>
    <div style="background:#7BE0C0;border-color:#7BE0C0;color:#134C3C;
      border-radius:999px;padding:16px 32px;font-size:30px;font-weight:800">点卡片上车</div>
  </div>
`
  )
);

// ---- 抖音封面 1080×1920 ----
write(
  "douyin.html",
  page(
    1080,
    1920,
    `
  <div style="position:absolute;inset:0;background:linear-gradient(160deg,#6E62EC 0%,#6255E7 42%,#463AB8 100%)"></div>
  <div class="blob" style="width:640px;height:640px;background:#8B7FF5;left:-200px;top:60px;opacity:.6"></div>
  <div class="blob" style="width:700px;height:700px;background:#3F34A8;right:-240px;bottom:-120px;opacity:.7"></div>
  <div style="position:absolute;left:0;right:0;top:140px;text-align:center;color:#fff;
    font-size:38px;font-weight:800;letter-spacing:5px;opacity:.85">${BRAND}</div>
  <div style="position:absolute;left:96px;right:96px;top:300px;color:#fff">
    <div style="font-size:112px;font-weight:900;line-height:1.22;letter-spacing:2px">
      开黑最难的<br/>不是打游戏<br/><span style="color:#7BE0C0">是凑人</span>
    </div>
    <div style="margin-top:64px;width:170px;height:12px;border-radius:999px;background:#7BE0C0"></div>
  </div>
  <div style="position:absolute;left:50%;top:900px;transform:translateX(-50%);
    width:540px;height:540px;border-radius:50%;
    background:rgba(255,255,255,.12);border:3px solid rgba(255,255,255,.24);
    display:flex;align-items:center;justify-content:center">
    <img src="${AVATAR}" style="width:414px;height:414px;border-radius:112px;display:block"/>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:400px;text-align:center;color:#fff;
    font-size:40px;font-weight:800">一条车丢进群，点开就能上车</div>
`
  )
);

// ---- 品牌通用配图（正方形，用于文章/朋友圈配图）----
write(
  "brand-square.html",
  page(
    1080,
    1080,
    `
  <div class="blob" style="width:480px;height:480px;background:#DCD6FF;right:-160px;top:-150px"></div>
  <div class="blob" style="width:420px;height:420px;background:#CFC7FF;left:-140px;bottom:-140px"></div>
  <div style="position:absolute;left:0;right:0;top:140px;text-align:center">
    <img src="${LOBBY}" style="width:760px;border-radius:56px;box-shadow:0 26px 60px rgba(98,85,231,.20)"/>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:190px;text-align:center">
    <div style="font-size:82px;font-weight:900">找队友，开一局</div>
    <div style="font-size:42px;font-weight:700;color:#6255E7;margin-top:24px">好玩的局，就差一个你</div>
    <div style="font-size:34px;font-weight:700;color:#8B84B8;margin-top:34px">${BRAND}</div>
  </div>
`
  )
);

console.log("html written to", buildDir);
