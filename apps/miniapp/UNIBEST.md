# unibest 基础模板来源与裁剪

发布目标仅微信和独立 QQ 小程序；H5 为本地开发检查用途，不新增其他宿主适配。

来源：<https://github.com/unibest-tech/unibest/tree/base>
核对提交：`dc3af8ddb99b78fa806078c80434b664a4b1ce93`，模板版本 4.4.1。
MIT 许可保留于 `LICENSE.unibest`。

本工程从已有官方 uni-app P0 原型迁移业务，再按该版本 unibest 基础模板合入和裁剪工程配置，该迁移工程现已成为唯一前端，原生微信目录与早期实验工程已清理。

保留：Vue 3、TypeScript、Vite 5、UniPages/UniManifest、UnoCSS presetUni 与旧颜色兼容、Pinia、统一请求层。全部页面和组件的交互控件统一使用 Wot UI 2.3.2；自有布局、间距、颜色与响应式规则统一使用 UnoCSS utilities、shortcuts 和 preflight。Wot UI 内部样式由组件库维护，分享封面的 Canvas 绘制逻辑保留。

裁剪：未使用的 layouts 插件、演示页、App 原生资源处理、未用图标集合、alova 请求层、z-paging、调试器自动注入、自动打开开发工具、自动初始化 Git 和模板上传脚本。采用既有 `uni.request` 传输层，不并行引入第二套请求库，不把敏感会话持久化到本地。

编译链沿用 P0 已验证的 DCloud `3.0.0-5020420260813003` 与 Vue 3.4.21；Pinia 固定为兼容的 2.1.7。UnoCSS 66.0.0 / unocss-applet 0.11.0 来自官方模板锁定组合。前端和上传工具的依赖统一由仓库根目录 pnpm-lock.yaml 固定；pnpm workspace 是本项目的仓库组织方式，不是直接照搬 unibest 官方仓库。

`pages.config.ts`、`manifest.config.ts` 是配置源。`src/pages.json`、`src/manifest.json` 和生成的页面类型不手动修改、不提交；每次 uni 构建自动生成。

所有 Vue 页面及组件现已采用 `<script setup lang="ts">`，使用 Vue 响应式状态与 uni-app 生命周期，移除了旧页面的 `this/setData` 适配。平台适配、API、Pinia 和业务类型使用 TypeScript。共享工具已全部转为 TypeScript，`allowJs: false`、`strict: true`；页面逻辑集中到 `src/composables`，移除了旧 `getApplication`、事件 dataset、cloud/state 适配层。API action、请求参数与响应建立了类型映射，并有编译期契约检查。

未引入 layouts 的原因：当前页面无需独立布局包装，0.1.11 经 c12/giget 引入 tar 6.2.1 的严重安全告警，删除该未使用依赖。manifest 插件也仍经 c12/giget 依赖 tar 6.2.1，故严重告警并未全部消除；其余编译链依赖也有安全告警，尚未作为生产发布候选完成升级审计。

工程检查使用 ESLint、Prettier、Husky 与 lint-staged；未引入 Stylelint（自有样式没有独立 CSS/SCSS 文件）与 commitlint（当前没有强制提交信息规范需求）。安装依赖后运行 根目录 `pnpm hooks:install` 启用本地提交前检查，CI 同样运行 lint 与格式检查。

CI 上传现由仓库 `scripts/miniapp` 和 `.github/workflows` 独立维护，先支持微信与 QQ；没有恢复模板内的上传脚本。配置见 [自动上传说明](../../docs/微信QQ自动上传.md)。
