# QQ 小程序接入调研（2026-10-30 修订）

本文记录 QQ 小程序开发指南、微信/QQ 兼容现状，以及本项目在已有微信小程序前提下运行到 QQ 的可行路径。**2026-10-30 修订：前一版把 QQ 当作可正常入驻的新平台，结论有误。实测官方站点后已重写，核心结论是「QQ 小程序已无法新注册」。**

## 一、结论（务必先看）

0. **⭐ 实测结论（2026-10-30）：两条路都已关闭。** QQ 客户端自 9.1.70 起支持直接打开微信小程序（搜索到、带「微信兼容版」角标、开发者无需改代码），**但本项目实测被判定为「非兼容小程序」**：QQ 内能搜到名称和图标，点击后提示「当前不支持的"QQ"打开该小程序，可前往微信打开」。而独立 QQ 小程序又因 `q.qq.com` 公告「暂不支持创建新的小游戏/小程序」拿不到 AppID。**且任何替代方案都需要重建后端**（H5 目前无登录、无数据层），因此建议默认放弃 QQ 端；详见[第六节](#六现在怎么办行动方案)。
1. **QQ 开放平台已暂停创建新的小程序/小游戏。** 官方站点 `q.qq.com` 首页「系统公告」区原文：**「平台维护中，暂不支持创建新的小游戏/小程序。很抱歉给您带来不便！」** 并给出客服邮箱（小程序：`qq-miniprogram@tencent.com`）。**没有 QQ AppID 的开发者现在无法入驻。**
2. **因此，本项目原计划的路线（独立 QQ 小程序）走不通** —— 不是代码问题，而是拿不到 AppID。仓库 `apps.json` 里 `qq.appid` 为空、`.env.example` 写「leave empty until registered」，实际是**无法完成注册**。
3. **QQ 开发者工具并未「几个月没更新」，但更新极不规律且平台已停滞。** 最新版 `0.73.2608270.20`（2026-08-27）距本次核查仅 64 天；但在此之前的 `0.72.2502070.19`（2025-02-07）到它间隔了 **566 天**，而基础库最后版本停在 **v1.60.0（2022-12-22）**。准确说法是：工具偶有维护，底层框架与生态多年停滞。
4. **QQ 已转向「全面接入微信小程序」。** 2025-07-01 官方公告，QQ 端直接运行微信小程序本体，需通过插件 `qq-wxmini-plugin` 区分环境与处理登录。这是当前唯一有实际意义的 QQ 路径。
5. **uni-app 官方文档「写了」怎么开发 QQ 小程序，但只到编译层面。** `mp-qq` 是正式的 `%PLATFORM%` 取值（`npm run build:mp-qq`），`manifest.json` 有 `mp-qq` 节点（2.1.0+），条件编译用 `MP-QQ`。但**没有 QQ 平台自身的开发教程**（类目/审核/开放能力要去 `q.qq.com/wiki`），且其 `appid` 说明「登录 https://q.qq.com 申请」**已随平台公告失效**。unibest 同理：支持编译，无专门章节。
6. **核心判断：框架支持 ≠ 平台可用；而「平台入驻」和「在 QQ 里跑起来」也是两件事。** 前者已关闭，后者可能已经天然成立。

## 二、官方一手证据

### 2.1 暂停创建（决定性）

来源：[QQ 开放平台首页](https://q.qq.com/)，2026-10-30 实抓，首页系统公告区原文：

> 平台维护中，暂不支持创建新的小游戏/小程序。很抱歉给您带来不便！如有疑问，请联系以下客服。
> 小游戏：wanba@tencent.com
> 小程序：qq-miniprogram@tencent.com

同一页面的能力入口已明显偏向「机器人」「QQ 功能 Skill 库」「游戏社区服务」，小程序仅作为并列入口之一。

### 2.2 开发者工具版本（含实测解码）

来源：[wingetly: Tencent.QQDevTools](https://wingetly.io/apps/tencent/qqdev-tools) 版本历史。版本号内嵌日期，解码后：

| 版本号 | 内嵌日期 | 距 2026-10-30 |
| --- | --- | --- |
| `0.71.2402220.7` | 2024-02-22 | 981 天 |
| `0.72.2410230.13` | 2024-10-23 | 737 天 |
| `0.72.2411280.16` | 2024-11-28 | 701 天 |
| `0.72.2502070.19` | 2025-02-07 | 630 天 |
| **`0.73.2608270.20`** | **2026-08-27** | **64 天（最新）** |

解读：工具**有**近期更新（最新版仅 64 天），但 2025-02 到 2026-08 之间断了 566 天，且仅有一次跳版。这与「平台事实上低维护」一致，与「好几个月没更新」在当前时点略有出入——**最新版是 2026-08-27**。

### 2.3 基础库冻结

来源：[QQ 小程序现状与定位](https://illegalscreed.cn/zh/mobile-desktop/miniprogram/qq-miniprogram/guide-line/status)、[miniappmarket: QQ 小程序](https://www.miniappmarket.com/docs/platforms/qq-miniprogram)：官方 changelog 最新条目为 **v1.60.0（2022-12-22）**，2023–2026 无新版本记录。后者也记录「开发者工具停在 2024 年 2 月」，其核查时间早于 2026-08 的新版。

### 2.4 QQ 全面接入微信小程序

来源：[IT之家](https://www.ithome.com/0/864/991.htm)、[PConline](https://news.pconline.com.cn/1943/19430032.html)（2025-07-01）：QQ 将全面接入微信小程序，支持在 QQ 内搜索并直接打开微信小程序；迁移后 QQ 端运行的就是微信小程序本体；存量旧版 QQ 小程序仍可更新使用；开发者需用插件 `qq-wxmini-plugin` 区分运行环境、处理登录逻辑。

## 三、uni-app / unibest 如何开发 QQ 小程序

### 3.1 unibest 的官方口径

来源：[unibest 官方文档·简介](https://unibest.tech/base/1-introduction)、[插件市场页](https://ext.dcloud.net.cn/plugin?id=24138)、[create-unibest](https://www.npmjs.com/package/create-unibest)：

- unibest = uni-app + Vue3 + TS + Vite5 + UnoCSS + wot-ui，命令行运行 web / 小程序 / App。
- 官方原文：**「unibest 默认支持所有的 uniapp 平台（H5、小程序 和 App），但是具体支持情况还要看您所选的 UI 库是否支持。」**
- 平台清单含 QQ 小程序。
- 但 `create-unibest` 的 `--platform` 选项只列 `h5, mp-weixin, app, mp-alipay, mp-toutiao`——**脚手架默认不生成 mp-qq 配置**。

**关键点：unibest 文档里没有「如何开发 QQ 小程序」的专门章节。** 因为它的立场是「uni-app 支持什么平台，unibest 就支持什么」，QQ 只是众多编译目标之一。真正的开发方式就是 `uni-app` 的通用做法：

1. `manifest.config.ts` 中配置 `'mp-qq': { appid: '...' }`；
2. 用 `uni-app` 的 `#ifdef MP-QQ` 条件编译处理平台差异；
3. 构建 `uni-app build -p mp-qq`，用 QQ 开发者工具导入产物。

本项目正是这么做的（见第五节）。**所以「怎么开发」不是瓶颈，「有没有 AppID」才是。**

### 3.2 uni-app 官方文档写了什么

**写了，但只在「编译目标」层面，没有专门的 QQ 小程序开发教程页。** QQ 与微信/支付宝/抖音等并列，出现在通用文档的平台列表里。四处正式条目：

**(1) CLI 运行发布** —— [quickstart-cli](https://uniapp.dcloud.net.cn/quickstart-cli.html) 的 `%PLATFORM%` 表中明确列出：

| 值 | 平台 |
| --- | --- |
| `mp-qq` | qq 小程序 |

命令为 `npm run dev:mp-qq` / `npm run build:mp-qq`。dev 产物在 `dist/dev/`，build 产物在 `dist/build/`。

**(2) manifest 配置** —— [manifest.json 应用配置](https://uniapp.dcloud.net.cn/collocation/manifest.html) 中 `mp-qq` 节点自 **uni-app 2.1.0+** 支持，属性如下：

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `appid` | String | **qq 小程序的 AppID，登录 https://q.qq.com 申请** |
| `projectname` | String | 项目名称 |
| `requiredBackgroundModes` | Array | 后台能力，目前支持背景音频播放 |
| `navigateToMiniProgramAppIdList` | Array | 需要跳转的小程序列表 |
| `permission` | Object | 接口权限设置（如位置权限） |
| `workers` | String | Worker 代码目录 |
| `groupIdList` | String Array | 需要打开群资料卡的群号列表 |
| `optimization` | Object | 优化配置，支持 `subPackages` 分包优化 |
| `uniStatistics` | Object | 是否开启 uni 统计 |
| `scopedSlotsCompiler` | String | Vue2 作用域插槽编译模式 |
| `nativeTags` | Array | QQ 小程序平台的原生组件（4.81+） |

> ⚠️ **注意 `appid` 那一行的说明「登录 https://q.qq.com 申请」已失效** —— 该站点现已公告「暂不支持创建新的小游戏/小程序」。uni-app 文档此处未跟进平台变化。

**(3) 条件编译** —— [条件编译处理多端差异](https://uniapp.dcloud.net.cn/tutorial/platform.html) 中 `MP-QQ` 是正式取值，`MP` 聚合值也包含 QQ：

```js
// #ifdef MP-QQ
qq.getSystemInfoSync().AppPlatform; // 'qq'
// #endif
```

支持的文件：`.vue/.nvue/.uvue`、`.js/.uts`、`.css`、`pages.json` 及各预编译语言。另有 `static/mp-qq/` 专有静态资源目录约定。

**(4) 自定义项目配置** —— vue3 项目可用 `project.qq.json`（或 `project.config.json`）自定义小程序项目配置，避免多平台共用一个文件。

**已知平台差异（官方明确提到）**：[小程序自定义组件支持](https://uniapp.dcloud.net.cn/tutorial/miniprogram-subject.html) 指出 —— **「QQ 小程序目前对内联的 wxs 支持不好，部分写法可能会导致编译出错，尽量使用外部引入的方式」**。

### 3.3 结论：文档有，但只到「怎么编译」

uni-app 把 QQ 当作**众多输出端之一**，提供的是「配置 + 编译 + 条件编译」三件套，**不提供 QQ 平台自身的开发指南**（类目、审核、开放能力那些要去 `q.qq.com/wiki`）。所以：

- 「怎么开发 QQ 小程序」→ uni-app 文档能答：配 `mp-qq` 节点、用 `MP-QQ` 条件编译、`build -p mp-qq`；
- 「能不能开发」→ uni-app 文档答不了：它的 `appid` 说明还停在「登录 q.qq.com 申请」，而该入口已关闭。

**框架支持 ≠ 平台可用。uni-app 负责编译，不负责给你 AppID。**

### 3.4 本项目已具备的

- `@dcloudio/uni-mp-qq` 依赖已装；
- `manifest.config.ts` 已配 `'mp-qq': { appid: process.env.VITE_QQ_APP_ID || '' }`；
- `build:qq` 脚本 + `check-share-hooks.mjs mp-qq` 校验；
- `release.mjs` 已支持 QQ（校验 `qqappid`、要求 HTTPS 业务 API、凭据 `QQ_APP_TOKEN`）。

## 四、本项目实测状态（2026-10-30）

| 项目 | 现状 |
| --- | --- |
| `pnpm run build:qq` | **通过**，产物 `apps/miniapp/dist/build/mp-qq/` |
| 分享钩子校验 | 通过：`mp-qq: native share hooks verified for 8 pages` |
| 产物 `project.config.json` | `"qqappid": "touristappid"`（未配置 AppID 的占位值） |
| QQ AppID | **为空，且现在无法申请** |
| QQ 登录后端 | `/v1/auth/qq`、`/v1/rpc`、`/v1/media/avatar` 均未实现 |

**结论：编译链路健康，但因为拿不到 AppID，独立 QQ 小程序路线事实上已不可推进。**

## 五、路径选择（修订后）

### 路径 A：独立 QQ 小程序 —— ❌ 当前不可行

依赖 QQ AppID。官方已暂停创建新小程序/小游戏。除非该账号此前已持有 QQ 小程序且仍可登录后台，否则无法走通。

> 若你确实已有存量 QQ 小程序账号：登录 `q.qq.com` 后台确认能否「上传/提审」；存量小程序官方口径仍支持版本更新和使用。此时本仓库的 `build:qq` 链路可直接用。

### 路径 B：QQ 内运行微信小程序 —— ⚠️ 本项目实测不通过

以微信小程序为唯一代码本体，QQ 端运行微信小程序，无需 QQ AppID。

机制上确实存在（QQ 9.1.70+，搜索带「微信兼容版」角标即可打开），**但本项目实测被判定为「非兼容小程序」而拦截**，详见 [6.1 实测结果](#61-第一步实测结果2026-10-30已完成)。也就是说：这条路对「主流大厂小程序」成立，对当前这个项目不成立。

若后续 QQ 放开兼容名单，需要做的适配是：

1. 接入 QQ 插件 **`qq-wxmini-plugin`** 区分运行环境、处理登录（[IT之家](https://www.ithome.com/0/864/991.htm)）。
2. 环境判断可用 `qq.getSystemInfoSync().AppPlatform === 'qq'` 或插件提供的方法。
3. 登录仍需区分：QQ 环境走 QQ 登录态，微信环境走微信登录态（openid 不通用）。
4. **重点风险：微信云开发**。腾讯云 FAQ 明确「微信 IDE 创建的云开发环境不能在 QQ 小程序中使用」，且云开发开放 API 的免鉴权调用「QQ 侧尚在规划中」。本项目云函数与头像上传全走 `wx.cloud`，即使放开兼容也需重做后端适配。

### 路径 C：H5 覆盖 QQ 用户 —— ⚠️ 不是免费选项（已更正）

项目虽有 `build:h5`，但**H5 目前只是 UI 空壳，没有任何数据能力**。代码依据：

- `src/api/client.ts` 的 `ensureSession()` 首行即 `if (options.target !== 'mp-qq') throw ...`，H5 走 `invoke()` 时必然抛 `PLATFORM_UNAVAILABLE`；
- `src/platform/host.ts` 的 `capabilities.nativeLogin` 仅含 `mp-weixin`/`mp-qq`，H5 无登录；
- `wechatCloud` 仅 `mp-weixin` 可用，H5 无云函数通道。

也就是说：**H5 今天打开只能看到界面，登录、大厅、发车全部不可用。** 要让 H5 真正可用，需要实现原计划的整套 HTTPS 后端（`/v1/auth/*`、`/v1/rpc`、`/v1/media/avatar`）——**这正是「QQ 后端待接入」那部分工作，与 QQ 小程序路线的工作量相同**。

结论：H5 不是「已有构建、零成本」的捷径；它是「换一个容器，但后端仍要从零建」。

### 路径 C′：H5 引导页 —— 低成本但价值有限

如果只是想「在 QQ 里有个落地页」，可以做一个**静态引导页**（非完整应用）：展示小程序名称、简介和小程序码，提示「请用微信扫码打开」。不依赖任何后端。

- 成本：半天以内；
- 价值：低——QQ 用户需自行扫码并跳转到微信，转化率不高；
- 适用：只想在 QQ 群分享链接时有个像样的落地页。

### 路径 D：放弃 QQ 端 —— 建议的默认选项

鉴于 QQ 小程序基础库停在 2022-12、开发者工具长期低频更新、本项目已被兼容名单排除、且任何替代路径都需要重建后端，投入产出比极低。维持微信单端是合理选择。本项目 QQ 相关代码是**构建期就绪、运行期未验证**的状态，保留不会影响微信端（微信走 `nativeCall` 云函数）。

## 六、现在怎么办（行动方案）

### 6.0 先明确一件事：QQ 客户端本身就能打开微信小程序

2025-04 起 QQ 9.1.70 支持**在 QQ 内直接运行微信小程序**。官方口径与实测（[中国网/中国日报](http://ex.chinadaily.com.cn/exchange/partners/82/rss/channel/cn/columns/snl9a7/stories/WS680f389aa310205377030c83.html)、[新浪科技](https://finance.sina.cn/tech/2025-07-01/detail-infcyazh8860776.d.html)）：

- QQ 搜索栏输入小程序名字，结果直接出现该**微信小程序**，图标右下角带**绿色角标**；
- 第一次点击会自动跳转微信获取授权，确认后跳回 QQ 打开；
- 后续打开其他微信小程序无需再次授权；
- **开发者无需调整、无需重复开发**即可双端运行；
- 90% 以上的主流微信小程序已支持；**游戏类小程序（如《王者荣耀》）暂未纳入**。

**这意味着：本项目可能已经在 QQ 里能跑了，且不需要 QQ AppID、不需要改代码、不需要 QQ 后端。**

### 6.1 第一步实测结果（2026-10-30，已完成）

用手机 QQ 搜索「开黑星球｜游戏搭子」→ **能搜到**（名称、图标正常显示），但点击后进入拦截页：

> **「当前不支持的"QQ"打开该小程序，可前往微信打开。」** 底部按钮：**前往微信**

**结论：本项目被 QQ 判定为「非兼容小程序」，微信小程序在 QQ 内直接运行的路线（路径 B）对本项目不成立。**

判定依据（[IT之家](https://www.ithome.com/0/849/177.htm)、[搜狐转载](https://www.sohu.com/a/889327420_114760)）：

- QQ 对兼容的微信小程序，图标右下角带微信角标并标注「**微信兼容版**」；不兼容的标注「**QQ 原生版**」；
- 启动兼容版时 QQ 会调起微信申请昵称头像；**非兼容的则弹出上述提示**；
- 「并非所有微信小程序都能出现在 QQ 中，**只有部分小程序可以运行**」；
- 已知明确排除：**游戏类小程序（如《王者荣耀》）**。

**注意：能搜到 ≠ 能运行。** 能搜到说明小程序已在 QQ 索引里，拦截是 QQ 侧的**兼容性/白名单判定**，不是你代码或配置的问题。

### 6.2 为什么被判定为非兼容（均为推测，需向 QQ 确认）

公开资料没有给出开发者可自查的兼容性判定标准，以下按可能性排序：

1. **不在 QQ 的兼容白名单内。** 报道称只有「部分小程序」可运行，实际覆盖以主流大厂应用为主；个人/小团队作品被收录的概率较低。
2. **类目因素。** 若微信侧服务类目选了「游戏」，会直接落在已明确排除的范围。本项目实际是**游戏组队社交工具**（UGC 组队、无小游戏本体），类目理应为社交/工具类。
3. **主体类型。** QQ 互联相关文档提到「非游戏的主体或个人主体不支持注册开放平台」；若本项目为个人主体，可能受同一类限制（见 `docs/产品需求.md` 个人主体审核整改说明）。
4. **依赖微信云开发。** 腾讯云 FAQ 明确：微信 IDE 创建的云开发环境「**不能在 QQ 小程序中使用**」，且「微信小程序基于云开发提供的开放 API 免鉴权调用，QQ 侧尚在规划中」。本项目重度依赖 `wx.cloud`（云函数、头像上传），若兼容层不支持，即使放开也会运行失败。

### 6.3 还能做什么（按性价比排序）

| 方案 | 成本 | 成功率 | 说明 |
| --- | --- | --- | --- |
| **A. 问 QQ 客服**（已执行 2026-10-30） | 5 分钟 | 低但免费 | 邮件已发至 `qq-miniprogram@tencent.com`。见下方「关于联系渠道」。 |
| **B. 核对并修正微信侧类目** | 中（需微信审核） | 不确定 | 若类目确实是「游戏」，改成社交/工具类后再观察。**但改类目会影响微信端已有审核结论，风险自担**，且无法保证 QQ 侧随之放开。 |
| **C. 完整 H5 版** | **高**（需重建整套 HTTPS 后端） | 中 | ❌ 原判断「成本低」有误：H5 目前无登录、无数据层（`ensureSession` 对非 `mp-qq` 直接抛错），要可用必须实现 `/v1/auth/*`、`/v1/rpc`、`/v1/media/avatar`。工作量与 QQ 小程序后端相同。 |
| **C′. H5 静态引导页** | 低（半天） | 高（但价值低） | 只做落地页：名称、简介、小程序码 + 「请用微信扫码打开」。不依赖后端，但用户需跳到微信，转化率低。 |
| **D. 放弃 QQ 端** | 0 | — | 鉴于平台基础库停在 2022-12、生态停滞，且所有替代路径都需重建后端，建议作为默认选项。 |

#### 关于联系渠道（重要）

三个邮箱都来自 `q.qq.com` 官方页面，但**分工不同**，发错大概率得到「非本业务」或模板回复：

| 邮箱 | 官方出处 | 实际职责 | 是否对口本项目问题 |
| --- | --- | --- | --- |
| `qq-miniprogram@tencent.com` | 首页公告、[FAQ](https://q.qq.com/wiki/FAQ/devlop/) | **QQ 小程序平台**客服：入驻、资质审核、开户、后台操作 | ❌ 大概率不对口。本项目问题是「微信小程序在 QQ 客户端内的互通兼容性」，属 QQ 客户端/互通能力，不是小程序平台后台业务 |
| `qq_open@tencent.com` | [平台入驻文档](https://q.qq.com/wiki/) | QQ 开放平台**总**客服 | ⚠️ 更宽，可能帮转，但仍是开发者平台口径 |
| `wanba@tencent.com` | 首页公告 | 小游戏 | ❌ 与本项目无关 |

**更实际的渠道**：腾讯客服 [kf.qq.com](https://kf.qq.com/)（选「QQ-小程序」分类），面向普通用户/开发者的综合入口，路由能力通常比定向邮箱强。

> 结论：**没有专门面向「微信小程序在 QQ 内兼容性判定」的公开开发者反馈通道**。这是黑盒策略，任何渠道都只能问、不能改。方案 A 的真实价值是「问过了、确认没戏」，从而安心选 D，而不是指望它解决问题。

### 6.4 明确不要做的

- ❌ **不要继续推进独立 QQ 小程序（路径 A）**：`q.qq.com` 已公告「暂不支持创建新的小游戏/小程序」，拿不到 AppID，`mp-qq` 产物只能停留在 `touristappid`。
- ❌ **不要实现 `/v1/auth/qq` 等 QQ 后端**：依赖 QQ AppID/AppSecret，无法联调。
- ❌ **不要为 QQ 单独维护一套包体**：官方方向是复用微信本体，且本体已被判非兼容。
- ❌ **不要靠改代码试图绕过兼容判定**：拦截发生在运行之前，与小程序内部实现无关。

### 6.5 一句话总结

> **两条路都已关闭**：独立 QQ 小程序拿不到 AppID；QQ 内跑微信小程序被判「非兼容」。问询邮件已于 2026-10-30 发出（方案 A），等回复即可，不阻塞其他工作。
>
> **不建议再为 QQ 投入开发**：完整 H5 需重建整套 HTTPS 后端（方案 C，成本高）；若只想要个 QQ 内落地页，可做静态引导页（方案 C′，半天，价值有限）。**默认建议方案 D：维持微信单端。**

## 七、风险与注意事项

- **「编译通过」在本项目里不等于可用**：`build:qq` 通过只证明编译与原生分享标记正确。
- **登录态隔离**：QQ 与微信 openid 不通用，不要复用微信 openid。
- **不要照搬微信新能力**：QQ 基础库停在 2022-12，微信近年新能力（如分享到朋友圈等）QQ 端可能不存在。
- **域名合规**：已备案 HTTPS，不能用 IP/localhost，健康探测地址不能当业务 API。
- **平台停滞**：即便能上线，QQ 端生态活跃度低、官方支持有限，宜作为补充渠道而非主力。

## 参考来源

- [QQ 开放平台首页（暂停创建公告，2026-10-30 实抓）](https://q.qq.com/)
- [QQ 小程序全局配置文档](https://q.qq.com/wiki/develop/miniprogram/frame/dispose.html)
- [QQ 小程序常见问题整理](https://q.qq.com/wiki/FAQ/devlop/)
- [uni-app CLI 运行发布（含 mp-qq）](https://uniapp.dcloud.net.cn/quickstart-cli.html)
- [uni-app manifest.json 应用配置（mp-qq 节点）](https://uniapp.dcloud.net.cn/collocation/manifest.html)
- [uni-app 条件编译处理多端差异（MP-QQ）](https://uniapp.dcloud.net.cn/tutorial/platform.html)
- [uni-app 小程序自定义组件支持（QQ wxs 差异）](https://uniapp.dcloud.net.cn/tutorial/miniprogram-subject.html)
- [unibest 官方文档·简介](https://unibest.tech/base/1-introduction)
- [create-unibest（npm）](https://www.npmjs.com/package/create-unibest)
- [wingetly: QQ小程序开发者工具版本历史](https://wingetly.io/apps/tencent/qqdev-tools)
- [miniappmarket: QQ 小程序平台](https://www.miniappmarket.com/docs/platforms/qq-miniprogram)
- [QQ小程序 现状与定位](https://illegalscreed.cn/zh/mobile-desktop/miniprogram/qq-miniprogram/guide-line/status)
- [中国网/中国日报：QQ 9.1.70 支持运行微信小程序（绿标、首次跳微信授权）](http://ex.chinadaily.com.cn/exchange/partners/82/rss/channel/cn/columns/snl9a7/stories/WS680f389aa310205377030c83.html)
- [新浪科技：微信与 QQ 实现小程序互通](https://finance.sina.cn/tech/2025-07-01/detail-infcyazh8860776.d.html)
- [IT之家：微信、QQ 又悄悄通了一下（非兼容提示、「微信兼容版」角标）](https://www.ithome.com/0/849/177.htm)
- [搜狐转载：微信、QQ 又悄悄通了一下](https://www.sohu.com/a/889327420_114760)
- [腾讯云 FAQ：微信云开发环境不能在 QQ 小程序中使用](https://cloud.tencent.cn/document/faq/876/18438)
- [IT之家：QQ 将全面接入微信小程序](https://www.ithome.com/0/864/991.htm)
- [PConline：腾讯宣布 QQ 将全面接入微信小程序](https://news.pconline.com.cn/1943/19430032.html)
- [QQ 互联：分享微信小程序到 QQ](https://wiki.connect.qq.com/%E5%88%86%E4%BA%AB%E5%BE%AE%E4%BF%A1%E5%B0%8F%E7%A8%8B%E5%BA%8F%E5%88%B0qq/)
