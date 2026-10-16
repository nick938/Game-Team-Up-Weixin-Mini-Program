# 开黑星球 · uni-app 前端

工程构建目标为微信和**独立 QQ 小程序**；QQ 后端尚未完成接入。H5 仅供开发、界面检查和诊断。使用裁剪后的 unibest 工程配置、uni-app / Vue 3 / TypeScript / Vite / UnoCSS / Pinia / Wot UI。

## 开发和检查

本目录是根 pnpm workspace 的前端包；依赖与锁文件由仓库根目录统一管理，Node.js 24 / pnpm 10.34.5。日常命令在根目录执行，单独运行前端脚本使用 `pnpm --filter game-team-miniapp <命令>`。

```sh
# 在仓库根目录执行
pnpm install --frozen-lockfile
pnpm dev
pnpm check:matrix
```

`check:matrix` 顺序执行 ESLint、Prettier 格式检查、本地行为测试、严格类型检查和 微信/QQ 构建与 H5 开发检查，输出 `dist/p0/build-results.json`。在受限文件监听环境中可加 `CHOKIDAR_USEPOLLING=1` 运行命令。本仓库根目录的服务端、共享规则及 Vue 组件回归为 `pnpm run test:server`。

- 微信产物：`dist/build/mp-weixin/`，导入微信开发者工具；使用现有微信 AppID 与云函数环境。
- QQ 产物：`dist/build/mp-qq/`，后续导入 QQ 开发工具；需要独立 QQ AppID、服务端配置及合法域名。
- H5 主要用于前端检查。不提供假登录或自动读取生产业务的旁路；没有业务会话时不能把空列表当作线上数据。

## 当前工程

唯一业务前端，页面与组件全部使用 `<script setup lang="ts">`，共享业务工具全部使用严格 TypeScript。交互统一采用 Wot UI，自有样式统一采用 UnoCSS，测试读取当前 uni-app 源码。

10 个业务页面和原路由：大厅、游戏页、发车、我的、详情、协议、反馈、报错、举报、管理端。公共组件包括统一页面壳、Wot 表单入口、队伍卡片、资料填写、欢迎信、成员资料、队伍管理和管理端统计。保留游戏目录、分页/排序、日期时长规则、必填加入方式、密码可见提示、代开和管理员交互。

微信使用集中适配的现有 `team` 云调用；QQ 使用 `uni.login` 取得宿主 code，再调用 HTTPS 登录/业务接口。QQ 不初始化 `wx.cloud`、不复用微信订阅模板、不使用微信专用头像按钮；使用跨端选图和手填昵称。

## 目录与分层

- `src/pages`：页面模板和路由入口。
- `src/composables`：页面状态、生命周期与业务编排；`usePageFeedback` 统一 Wot 提示与确认框。
- `src/components`：Wot 组合组件与可复用表单入口。
- `src/api`、`src/platform`：业务请求与宿主能力适配。
- `src/stores`、`src/types`、`src/utils`：共享状态、业务契约与纯工具。
- `uno.config.ts`：设计颜色、公共布局 shortcuts、全局基础样式与 Wot 主题。

## QQ 接入契约和未完成项

现有微信云函数、数据库和存储继续保留。QQ 客户端已准备以下 HTTPS 契约，后端实现与接入方式仍待验证；本文不将新建环境、搬库或微信切换后端作为既定步骤。

复制 `.env.example` 为 `.env.local`：

```dotenv
VITE_QQ_APP_ID=独立QQ小程序AppID
VITE_API_BASE_URL=https://你的测试API域名
```

这些是公开构建配置，不放 AppSecret、登录 code 或 token。真实登录、真机运行和发布验收需要有效 QQ AppID、已部署的接口及合法域名。

客户端已经准备以下 **待后端实现/部署的兼容接口**，并非现有线上 API：

| 接口                    | 输入                           | 输出与约束                                                                                    |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `POST /v1/auth/qq`      | `{code}`                       | 后端向 QQ 核验后返回 `{ok:true, accessToken, expiresAt}`；expiresAt 为毫秒时间戳              |
| `POST /v1/rpc`          | `{action,input}` + Bearer 会话 | 兼容现有 action 的临时桥接契约；服务端白名单、统一 actor 和权限校验；不可直接暴露旧 team 入口 |
| `POST /v1/media/avatar` | multipart file + Bearer 会话   | 校验归属、大小、格式和内容后返回 `{ok:true,fileID}`；资料接口再返回可读 HTTPS 展示地址        |

会话只在内存保存，临近过期重新登录；401 清除会话，写操作不自动重放。现有服务端身份模块还只是独立基础实现，未接入生产入口。跨端共享用户/队伍、内容检测、头像上传和通知需要后端统一身份改造后才能业务闭环；仅填 API 域名不会让这些接口自动存在。

## 验收层级

本地测试/类型检查/多端编译、H5 浏览器交互、微信真机回归、QQ 真机业务验收分别记录。当前构建成功不能作为 QQ 正常登录、共用大厅或跨端上车已完成的证据。

后续 QQ 接入需单独验证后端鉴权、业务权限、头像访问和两端组队流程；当前不以仅填 API 域名或编译成功作为业务可用的证据。

## 模板来源与裁剪

工程配置参考 [unibest base](https://github.com/unibest-tech/unibest/tree/base)，核对提交 `dc3af8ddb99b78fa806078c80434b664a4b1ce93`、模板版本 4.4.1；MIT 许可保留在 [LICENSE.unibest](LICENSE.unibest)。

保留 UniPages/UniManifest、UnoCSS、Pinia 与现有 `uni.request` 请求层；未引入 layouts、alova、z-paging、模板演示页及模板上传脚本。页面无需额外布局包装，工程和上传脚本由本仓库维护。DCloud、Vue、Wot UI 等依赖版本见 package.json，统一由仓库根 pnpm-lock.yaml 锁定。

`pages.config.ts`、`manifest.config.ts` 是配置源；生成的 `src/pages.json`、`src/manifest.json` 和页面类型不手动修改或提交。检查使用 ESLint、Prettier、Husky 与 lint-staged，安装依赖后在根目录运行 `pnpm hooks:install` 启用提交前检查。

2026-10-16 整理时仍记录有工具链依赖安全告警，包括 manifest 插件经 c12/giget 引入的 tar 6.2.1；删除未使用的 layouts 插件并未消除全部告警。该记录不代表已完成当前版本的依赖安全审计。

## 自动上传

微信、QQ 使用统一应用清单与 GitHub Actions，参见 [微信 / QQ 自动上传](../../docs/微信QQ自动上传.md)。默认版本读取本目录 package.json，支持单次构建覆盖。
