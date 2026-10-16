# 开黑星球 · uni-app 前端

产品仅面向微信和**独立 QQ 小程序**；H5 仅供开发、界面检查和诊断。使用裁剪后的 unibest 工程配置、uni-app / Vue 3 / TypeScript / Vite / UnoCSS / Pinia / Wot UI。模板来源和裁剪见 [UNIBEST.md](UNIBEST.md)。

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

## 当前已迁移

唯一业务前端，页面与组件全部使用 `<script setup lang="ts">`，共享业务工具全部使用严格 TypeScript。交互统一采用 Wot UI，自有样式统一采用 UnoCSS，已移除旧 CSS、行内样式及旧页面适配器。原生 `miniprogram` 和 `experiments/p0-uniapp` 已移除，测试读取当前 uni-app 源码。

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

目标后端采用腾讯云 CloudBase 控制台创建的新环境，并完成 QQ 小程序账号与腾讯云账号绑定；不直接使用微信 IDE 创建的旧环境作为 QQ 云开发环境。现有前端仍通过 HTTPS 接入，接口将在新环境实现与部署；完整步骤见 [迁移计划](../../docs/微信QQ迁移与发布计划.md#已确定的云环境方案)。

复制 `.env.example` 为 `.env.local`：

```dotenv
VITE_QQ_APP_ID=独立QQ小程序AppID
VITE_API_BASE_URL=https://你的测试API域名
```

这些是公开构建配置，不放 AppSecret、登录 code 或 token。当前尚无 QQ 账号/AppID，不能执行真实登录、真机运行或发布验收。

客户端已经准备以下 **待后端实现/部署的兼容接口**，并非现有线上 API：

| 接口                    | 输入                           | 输出与约束                                                                                    |
| ----------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `POST /v1/auth/qq`      | `{code}`                       | 后端向 QQ 核验后返回 `{ok:true, accessToken, expiresAt}`；expiresAt 为毫秒时间戳              |
| `POST /v1/rpc`          | `{action,input}` + Bearer 会话 | 兼容现有 action 的临时桥接契约；服务端白名单、统一 actor 和权限校验；不可直接暴露旧 team 入口 |
| `POST /v1/media/avatar` | multipart file + Bearer 会话   | 校验归属、大小、格式和内容后返回 `{ok:true,fileID}`；资料接口再返回可读 HTTPS 展示地址        |

会话只在内存保存，临近过期重新登录；401 清除会话，写操作不自动重放。现有服务端身份模块还只是独立基础实现，未接入生产入口。跨端共享用户/队伍、内容检测、头像上传和通知需要后端统一身份改造后才能业务闭环；仅填 API 域名不会让这些接口自动存在。

## 验收层级

本地测试/类型检查/多端编译、H5 浏览器交互、微信真机回归、QQ 真机业务验收分别记录。当前构建成功不能作为 QQ 正常登录、共用大厅或跨端上车已完成的证据。

后续先在腾讯云 CloudBase 控制台创建测试环境并完成 QQ 账号绑定，再实现后端身份映射、会话和业务接口，配置 QQ AppID/域名，执行两个真实账号的发车、跨端加入、密码/角色校验和头像互看。微信切换新后端还需新增 `/v1/auth/weixin`、客户端会话与头像适配，以及旧数据和文件引用迁移；这些均未完成。当前不迁生产数据。

历史构建与浏览器检查摘要见 [迁移与发布计划](../../docs/微信QQ迁移与发布计划.md#6-本次范围收拢验证)。工具链仍有已知依赖安全告警，来源与维护边界见 [UNIBEST.md](UNIBEST.md)。

## 自动上传

微信、QQ 使用统一应用清单与 GitHub Actions，参见 [微信 / QQ 自动上传](../../docs/微信QQ自动上传.md)。默认版本读取本目录 package.json，支持单次构建覆盖。
