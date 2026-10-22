# 开黑星球｜游戏搭子

游戏组队小程序：发车、分享车辆邀请、上车并复制加入方式。大厅提供搜索、筛选、卡片反馈、每日游戏投票和用户排行；底部保留「大厅 / 发车 / 我的」三个入口。

当前唯一前端位于 `apps/miniapp`，使用 uni-app、Vue 3、TypeScript、Pinia、UnoCSS 和 Wot UI 2.3.2。微信调用现有 `team` 云函数；QQ 前端可构建，独立 HTTPS 业务后端仍待接入。H5 用于开发和界面检查。

## 开发与验证

使用 Node.js 24 和 pnpm 10.34.5，在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

- `pnpm check`：lint、格式、类型检查和前后端测试。
- `pnpm build:weixin` / `pnpm build:qq` / `pnpm build:h5`：分别构建各端。
- `pnpm check:matrix`：服务端测试，加前端检查与三端构建，报告位于 `apps/miniapp/dist/p0/build-results.json`。
- 本机遇到文件监听 `EMFILE` 时，在命令前加 `CHOKIDAR_USEPOLLING=1`。

构建入口 `apps/miniapp/scripts/uni.mjs` 会先从 `manifest.config.ts` 生成配置，支持全新检出；生成的 `src/manifest.json`、`src/pages.json` 和类型声明不手改、不提交。微信和 QQ 构建还会检查分享页面的原生事件是否注册，缺失即失败。

## 当前功能与入口

| 页面                     | 实际入口与用途                                             |
| ------------------------ | ---------------------------------------------------------- |
| 大厅、发车、我的         | 原生底部 TabBar；搜索队伍、发布/编辑、个人资料与个人队伍   |
| 今天玩啥、用户排行       | 大厅两个入口；每日提议/投票、发车榜和上车榜                |
| 车辆详情、接手官方车     | 点击车辆或分享卡片；每日待发车由首位提交完整表单的玩家接手 |
| 游戏组队页               | 详情的同游戏入口、游戏跳转及搜一搜落地，保留现有分享路径   |
| 我的队伍、设置中心       | 我的页面；查看发起/加入记录、编辑资料及协议                |
| 帮助、更新公告、更新日志 | 我的和帮助入口；公告也有首次展示提示                       |
| 协议、反馈、报错、举报   | 设置、帮助、欢迎信或车辆详情中的对应入口                   |
| 管理端                   | 管理员在我的页面进入，云函数验证权限                       |

页面配置维护在 `apps/miniapp/pages.config.ts`，当前共 18 页。没有产品入口的接入诊断页已移除；独立 HTTP 探测仍可通过命令行使用。

- 大厅默认展示有空位和满员车辆，可手动开启「只看可加入」；游戏平台字段保留兼容，筛选不提供平台选项。
- 发车备注最多 1000 字；加入方式公开，密码按成员权限返回；时间重叠提示后可以继续。
- 卡片提供赞、踩、喜欢、下次一定，每人每车一个反馈，可切换或取消；请求防抖，失败回滚。
- 大厅转发和详情分享使用相同的车辆标题、详情链接与信息图；封面不展示平台标签，不包含房间号或密码。
- 公开资料展示昵称、头像、签名、群组、常玩游戏/时间和已填写的 Steam 好友码、微信 ID；排行和队伍成员入口使用相同资料抽屉。
- 投票按上海时区每日独立；16:00确定官方推荐车，固定21:00–23:00。发车/上车榜按队伍去重，兼容旧用户身份字段。

详细规则见 [产品说明](docs/产品需求.md)。

## 微信体验版与发布

```sh
pnpm build:weixin
```

微信开发者工具打开仓库根目录；`project.config.json` 指向 `apps/miniapp/dist/build/mp-weixin/`。构建后上传开发版本，在微信后台设为体验版，再用手机验收。体验版支持自定义分享标题和封面。

云函数有改动时，单独上传并部署 `cloudfunctions/team`，选择「云端安装依赖」，包含 `lib` 并保留 `startRemind` 定时器。前端构建、上传、体验版设置、提审/正式发布及云函数部署分别执行。本地测试不能代替真机分享、真实账号持久化和消息送达验证。

GitHub Actions 的 Miniapp CI 在代码 push / PR 后检查并构建微信；WeChat Upload 在推送 `vX.Y.Z` Tag 或手动触发时上传微信开发版本，不自动提审、上线或部署云函数。Tag、代码及最新更新日志版本须一致。QQ 不在 Actions 自动构建或上传。

## 目录与维护

```text
apps/miniapp/          唯一前端，页面、组件、平台适配和前端测试
cloudfunctions/team/  微信业务云函数，包含 lib 模块与定时提醒
cloudfunctions/p0Health/ 独立 HTTP 传输探测，仅保留命令行检查
scripts/miniapp/       发布计划、构建和上传工具
tools/miniapp-release/ 微信上传 SDK
tests/               服务端及共享规则回归测试
docs/                当前产品、维护、发布和运营资料
```

根目录维护唯一的 `pnpm-lock.yaml`；云函数保留独立依赖，由云端安装。开发规则见 [AGENTS.md](AGENTS.md)。

分享事件必须在页面 `.vue` setup 中直接调用 `onShareAppMessage` / `onShareTimeline` 注册，composable 只提供处理函数；仅在 composable 中注册会遗漏原生分享事件，表现为微信自动截取当前页面。规则和构建检查都需要保留。

- [前端工程与 QQ 接入](apps/miniapp/README.md)
- [维护、部署与真机验收](docs/维护与验收.md)
- [微信 Tag 自动上传](docs/微信Tag自动上传.md)
- [HTTP 探测工具](cloudfunctions/p0Health/README.md)
- [更新历史](CHANGELOG.md)
- [冷启动计划](docs/冷启动计划.md)、[推广文案](docs/推广文案.md)、[搜索排查与获客渠道](docs/搜索排查与获客渠道.md)
- [品牌素材](docs/brand/设计说明.md)、[推广素材](docs/promo/设计说明.md)
