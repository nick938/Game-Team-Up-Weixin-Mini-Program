# 开黑星球 · uni-app 前端

本目录是唯一业务前端，使用 uni-app、Vue 3、严格 TypeScript、Pinia、UnoCSS 和 Wot UI 2.3.2。微信调用 `cloudfunctions/team`；独立 QQ 小程序保留构建与 HTTPS 请求适配，后端接入仍待完成。H5 用于开发和界面检查。

## 开发命令

依赖和锁文件统一在仓库根目录维护，使用 Node.js 24、pnpm 10.34.5：

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm build:weixin
pnpm build:qq
pnpm build:h5
```

单独执行前端命令使用 `pnpm --filter game-team-miniapp <命令>`。`pnpm check:matrix` 执行服务端测试及前端检查、三端构建，报告写入 `dist/p0/build-results.json`；文件监听受限时使用 `CHOKIDAR_USEPOLLING=1`。

构建入口 `scripts/uni.mjs` 先从 `manifest.config.ts` 生成真实配置，再启动 uni CLI，避免全新检出缺少 manifest。版本支持 `MINIAPP_VERSION` 覆盖，公开 AppID 从环境配置读取。微信/QQ 构建完成后自动执行 `scripts/check-share-hooks.mjs`，检查 8 个分享页面的原生事件标记。

## 页面与结构

当前保留 18 个有入口或分享/搜索落地用途的页面，清单见 [根 README](../../README.md)。`pages/friday/friday` 实际是用户排行，保留旧路径兼容；不再注册无入口的 `pages/probe/index`。

| 目录 / 配置                             | 职责                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| `src/pages`                             | 页面模板、页面生命周期和原生分享事件注册               |
| `src/composables`                       | 业务状态、请求与交互处理，返回分享函数供页面注册       |
| `src/components`                        | Wot 组合组件、统一表单、队伍卡片及资料抽屉             |
| `src/api`、`src/platform`               | 业务调用、登录会话与宿主适配                           |
| `src/stores`、`src/types`、`src/utils`  | Pinia、业务契约与共享工具                              |
| `src/design`、`uno.config.ts`           | 页面主题、布局与样式；分享封面单独保留原车辆邀请图样式 |
| `pages.config.ts`、`manifest.config.ts` | 页面、TabBar、应用配置的维护源                         |
| `tests`                                 | 实际 Vue setup、响应式状态、分享数据及组件模板回归     |

页面和组件采用 `<script setup lang="ts">`。交互优先使用 Wot UI；队伍卡片转发使用原生 `button open-type="share"`，以保证 `data-card-share-id` 到达原生分享事件。生成的 `src/pages.json`、`src/manifest.json`、`src/types/uni-pages.d.ts` 不手改、不提交。

## 原生分享与车辆封面

`onShareAppMessage`、`onShareTimeline` 必须在页面 `.vue` setup 中直接注册，不能仅藏在 composable 或子组件中。uni-app 根据页面源码生成 `__runtimeHooks`；遗漏标记时微信不会调用自定义分享逻辑，而会截取当前页面。

列表和详情共用 `src/utils/team-share.ts` 的车辆标题/路径，以及 `team-cover.ts` 的绘图逻辑。列表通过原生按钮的车辆标识解析目标；画布位于页面层、不能放入自定义组件插槽。分享回调可通过 `promise` 等待车辆图片，绘制失败才回退品牌图。封面不展示平台、房间号或密码。

检查函数返回值和 H5 截图均不能代替原生事件验证。构建检查通过后，还需在体验版分别从大厅和详情分享、切换两辆车检查图片和跳转是否一致。

## QQ 待接入契约

复制 `.env.example` 为 `.env.local`，填写独立 QQ AppID 与测试 API 地址。这里仅放公开配置，不放 AppSecret、上传密钥、code 或 token。

| 待实现接口              | 约定                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| `POST /v1/auth/qq`      | 输入 `{code}`，返回 `{ok:true, accessToken, expiresAt}`，过期时间为毫秒时间戳  |
| `POST /v1/rpc`          | 输入 `{action,input}`，使用 Bearer 会话；后端验证动作白名单、身份和权限        |
| `POST /v1/media/avatar` | multipart 文件与 Bearer 会话，返回 `{ok:true,fileID}`，资料返回可读 HTTPS 头像 |

会话只在内存保存，临近过期重新登录，401 清会话，写操作不自动重放。QQ 不初始化微信云能力、不复用微信订阅消息；填写域名或编译成功不代表登录、头像或跨端组队已可用。

独立 HTTP 传输探测使用命令行 `check:http`，见 [p0Health](../../cloudfunctions/p0Health/README.md)，不提供小程序诊断页面。

## 发布与维护

微信开发工具打开仓库根目录，微信产物为 `dist/build/mp-weixin/`；QQ 产物为 `dist/build/mp-qq/`。前端上传、设置体验版、云函数部署及正式发布分别处理，见 [维护与验收](../../docs/维护与验收.md) 和 [微信 Tag 自动上传](../../docs/微信Tag自动上传.md)。

工程配置参考 [unibest base](https://github.com/unibest-tech/unibest/tree/base)，基准提交 `dc3af8ddb99b78fa806078c80434b664a4b1ce93`、模板版本 4.4.1；MIT 许可保留在 [LICENSE.unibest](LICENSE.unibest)。依赖实际版本以 `package.json` 和根 `pnpm-lock.yaml` 为准。
