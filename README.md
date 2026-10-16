# 开黑星球｜游戏搭子

使用 pnpm workspace 管理前端和上传工具。前端基于裁剪后的 unibest 工程配置构建，使用 uni-app、Vue 3、TypeScript、Vite、UnoCSS、Pinia 和 Wot UI。`apps/miniapp` 是唯一前端源码，微信原生工程与早期 P0 实验工程已移除。

## 项目结构

```text
package.json         根目录开发、检查和发布命令
pnpm-workspace.yaml  工作区范围及依赖构建许可
pnpm-lock.yaml       前端和上传工具统一锁文件
tools/miniapp-release/ 微信上传 SDK
apps/miniapp/         唯一前端，页面与组件全部采用 <script setup lang="ts">
cloudfunctions/team/ 现有微信业务后端：组队、资料、角色、审核和提醒
cloudfunctions/p0Health/ 独立 HTTP 接入诊断，供前端诊断页使用
tests/               服务端、共享业务规则与 Vue 组件回归测试
docs/                产品资料、跨端接口契约、品牌资源及历史验证记录
project.config.json  微信开发者工具入口，指向新前端的微信构建产物
```

## 本地开发

使用 Node.js 24 和 pnpm 10.34.5（根 `packageManager` 固定版本）。以下命令均在仓库根目录执行；启用 Corepack 后可由它选择固定版本的 pnpm。首次从旧工程切换时先移除旧的 `apps/miniapp/node_modules` 和 `tools/miniapp-release/node_modules`，再安装。安装会启用 Husky 提交检查；`--ignore-scripts` 安装后需额外执行 `pnpm hooks:install`。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

若当前系统文件监听报 `EMFILE`，使用 `CHOKIDAR_USEPOLLING=1 pnpm dev` 启用轮询。

H5 用于开发和界面检查。微信业务仍调用 `team` 云函数；QQ 等平台的 HTTPS 登录、业务和头像接口需要独立后端实现，当前不具备真实跨端业务闭环。配置方式见 [前端说明](apps/miniapp/README.md)。

## 微信开发与发布

```sh
pnpm build:weixin
```

构建完成后，用微信开发者工具打开仓库根目录；`project.config.json` 的 `miniprogramRoot` 已指向 `apps/miniapp/dist/build/mp-weixin/`，云函数根目录仍为 `cloudfunctions/`。修改前端后重新构建；不要直接修改构建产物。

云函数有改动时，单独上传并部署 `cloudfunctions/team`（云端安装依赖，保留定时触发器）。前端上传、云函数部署、体验版及正式发布是独立步骤。本次源码整理不包含部署和发布。

`cloudfunctions/team/mail.local.js` 是本地 SMTP 配置，不提交；可参考 `mail.example.js`。管理员通过 `ADMIN_OPENIDS` 环境变量或 `admins` 集合配置，组局员通过 `ORGANIZER_OPENIDS` 或管理端配置。业务入口仍由服务端校验角色和封禁状态。

## 验证

在仓库根目录安装依赖后执行：

```sh
pnpm check
pnpm check:matrix
```

根目录测试包含服务端身份、组队规则、提醒、权限、头像和朋友圈单页行为；前端测试覆盖会话、Vue 页面交互和组件事件。前端测试工具通过 Vue SFC 编译器执行实际 setup 与响应式状态，替换宿主 API 和网络请求。

`check:matrix` 执行 ESLint、Prettier、前端测试、严格类型检查以及 H5、微信、QQ、支付宝、抖音编译，结果写入 `apps/miniapp/dist/p0/build-results.json`。编译和本地测试不代替微信/QQ 真机登录、订阅消息、分享、头像及发车上车验收。

本次前端统一迁移与浏览器检查见 [Wot UI / UnoCSS 迁移验收](docs/Wot-UI与UnoCSS统一迁移验收.md)。

## 开发约定

- workspace 只包含 `apps/miniapp` 和 `tools/miniapp-release`，统一由根 `pnpm-lock.yaml` 锁定；不在子目录生成 npm 或 pnpm 锁文件。
- 云函数不加入 workspace，保留独立 `package.json`，继续通过微信开发者工具在云端安装依赖和部署。
- `pnpm dev` 开发 H5；`pnpm check` 执行规范、格式、类型与前后端测试；`pnpm check:matrix` 执行服务端测试与完整五端检查。单独操作前端可使用 `pnpm --filter game-team-miniapp <命令>`。

- 所有页面交互控件采用 Wot UI；自有样式采用 UnoCSS，颜色与公共布局统一维护在 `uno.config.ts`。
- 页面和组件使用 `<script setup lang="ts">`，应用状态由 Pinia 管理，页面状态使用 Vue 响应式 API。
- `pages.config.ts`、`manifest.config.ts` 是配置源；`src/pages.json`、`src/manifest.json` 和页面类型由构建生成。
- 微信专属能力集中放在 `src/platform/`，业务请求统一经过 `src/api/`。
- 业务类型集中在 `src/types/domain.ts`。共享业务工具全部使用 TypeScript，开启 `strict` 并禁用 `allowJs`。
- 默认版本号维护在 `apps/miniapp/package.json`；正式版显示宿主提供的发布版本号。
- 品牌运行资源位于 `apps/miniapp/src/static/images/`；宣传素材源文件与生成脚本位于 `docs/`。
- `docs` 中旧验证记录保留为历史证据，其中旧目录和旧测试数量不代表当前工程状态。

## 微信与 QQ CI 上传

相关代码 push / PR 后自动测试并编译两端。手动运行 **Miniapp Upload**，选择目标和版本，即可批量构建上传。首次需配置 GitHub Environments、上传凭据与微信 IP 白名单，见 [完整配置说明](docs/微信QQ自动上传.md)。本工作流不执行提审、正式上线或云函数部署。
