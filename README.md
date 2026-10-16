# 开黑星球｜游戏搭子

基于裁剪后的 unibest 工程配置构建，使用 uni-app、Vue 3、TypeScript、Vite、UnoCSS、Pinia 和 Wot UI。`apps/miniapp` 是唯一前端源码，微信原生工程与早期 P0 实验工程已移除。

## 项目结构

```text
apps/miniapp/         唯一前端，页面与组件全部采用 <script setup lang="ts">
cloudfunctions/team/ 现有微信业务后端：组队、资料、角色、审核和提醒
cloudfunctions/p0Health/ 独立 HTTP 接入诊断，供前端诊断页使用
tests/               服务端、共享业务规则与 Vue 组件回归测试
docs/                产品资料、跨端接口契约、品牌资源及历史验证记录
project.config.json  微信开发者工具入口，指向新前端的微信构建产物
```

## 本地开发

```sh
cd apps/miniapp
npm ci --ignore-scripts
npm run dev:h5 -- --port 5196
```

H5 用于开发和界面检查。微信业务仍调用 `team` 云函数；QQ 等平台的 HTTPS 登录、业务和头像接口需要独立后端实现，当前不具备真实跨端业务闭环。配置方式见 [前端说明](apps/miniapp/README.md)。

## 微信开发与发布

```sh
cd apps/miniapp
npm run build:weixin
```

构建完成后，用微信开发者工具打开仓库根目录；`project.config.json` 的 `miniprogramRoot` 已指向 `apps/miniapp/dist/build/mp-weixin/`，云函数根目录仍为 `cloudfunctions/`。修改前端后重新构建；不要直接修改构建产物。

云函数有改动时，单独上传并部署 `cloudfunctions/team`（云端安装依赖，保留定时触发器）。前端上传、云函数部署、体验版及正式发布是独立步骤。本次源码整理不包含部署和发布。

`cloudfunctions/team/mail.local.js` 是本地 SMTP 配置，不提交；可参考 `mail.example.js`。管理员通过 `ADMIN_OPENIDS` 环境变量或 `admins` 集合配置，组局员通过 `ORGANIZER_OPENIDS` 或管理端配置。业务入口仍由服务端校验角色和封禁状态。

## 验证

安装前端依赖后，在仓库根目录执行：

```sh
node --test tests/*.test.js
npm --prefix apps/miniapp run check:matrix
```

根目录测试包含服务端身份、组队规则、提醒、权限、头像和朋友圈单页行为；前端测试覆盖会话、Vue 页面交互和组件事件。前端测试工具通过 Vue SFC 编译器执行实际 setup 与响应式状态，替换宿主 API 和网络请求。

`check:matrix` 执行前端测试、类型检查以及 H5、微信、QQ、支付宝、抖音编译，结果写入 `apps/miniapp/dist/p0/build-results.json`。编译和本地测试不代替微信/QQ 真机登录、订阅消息、分享、头像及发车上车验收。

## 开发约定

- 页面和组件使用 `<script setup lang="ts">`，应用状态由 Pinia 管理，页面状态使用 Vue 响应式 API。
- `pages.config.ts`、`manifest.config.ts` 是配置源；`src/pages.json`、`src/manifest.json` 和页面类型由构建生成。
- 微信专属能力集中放在 `src/platform/`，业务请求统一经过 `src/api/`。
- 业务类型集中在 `src/types/domain.ts`。共享工具暂保留部分 JS，`checkJs` 尚未开启。
- 默认版本号维护在 `apps/miniapp/package.json`；正式版显示宿主提供的发布版本号。
- 品牌运行资源位于 `apps/miniapp/src/static/images/`；宣传素材源文件与生成脚本位于 `docs/`。
- `docs` 中旧验证记录保留为历史证据，其中旧目录和旧测试数量不代表当前工程状态。

## 微信与 QQ CI 上传

相关代码 push / PR 后自动测试并编译两端。手动运行 **Miniapp Upload**，选择目标和版本，即可批量构建上传。首次需配置 GitHub Environments、上传凭据与微信 IP 白名单，见 [完整配置说明](docs/微信QQ自动上传.md)。本工作流不执行提审、正式上线或云函数部署。
