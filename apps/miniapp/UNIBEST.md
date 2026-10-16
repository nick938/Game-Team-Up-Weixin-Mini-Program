# unibest 基础模板来源与裁剪

来源：<https://github.com/unibest-tech/unibest/tree/base>
核对提交：`dc3af8ddb99b78fa806078c80434b664a4b1ce93`，模板版本 4.4.1。
MIT 许可保留于 `LICENSE.unibest`。

本工程从已有官方 uni-app P0 原型迁移业务，再按该版本 unibest 基础模板合入和裁剪工程配置，该迁移工程现已成为唯一前端，原生微信目录与早期实验工程已清理。

保留：Vue 3、TypeScript、Vite 5、UniPages/UniManifest、UnoCSS presetUni 与旧颜色兼容、Pinia、统一请求层。Wot UI 用于资料保存与诊断组件，原业务布局样式优先保留。

裁剪：未使用的 layouts 插件、演示页、App 原生资源处理、未用图标集合、alova 请求层、z-paging、调试器自动注入、自动打开开发工具、自动初始化 Git/Husky 和上传脚本。采用既有 `uni.request` 传输层，不并行引入第二套请求库，不把敏感会话持久化到本地。

编译链沿用 P0 已验证的 DCloud `3.0.0-5020420260813003` 与 Vue 3.4.21；Pinia 固定为兼容的 2.1.7。UnoCSS 66.0.0 / unocss-applet 0.11.0 来自官方模板锁定组合。所有依赖使用本工程 package-lock.json 固定。

`pages.config.ts`、`manifest.config.ts` 是配置源。`src/pages.json`、`src/manifest.json` 和生成的页面类型不手动修改、不提交；每次 uni 构建自动生成。

所有 Vue 页面及组件现已采用 `<script setup lang="ts">`，使用 Vue 响应式状态与 uni-app 生命周期，移除了旧页面的 `this/setData` 适配。平台适配、API、Pinia 和业务类型使用 TypeScript。共享工具仍保留部分 JavaScript，`checkJs` 未开启，不能宣称全部工具逻辑已获得严格类型覆盖。

未引入 layouts 的原因：当前页面无需独立布局包装，0.1.11 经 c12/giget 引入 tar 6.2.1 的严重安全告警，删除该未使用依赖。manifest 插件也仍经 c12/giget 依赖 tar 6.2.1，故严重告警并未全部消除；其余编译链依赖也有安全告警，尚未作为生产发布候选完成升级审计。

CI 上传现由仓库 `scripts/miniapp` 和 `.github/workflows` 独立维护，先支持微信与 QQ；没有恢复模板内的上传脚本。配置见 [自动上传说明](../../docs/微信QQ自动上传.md)。
