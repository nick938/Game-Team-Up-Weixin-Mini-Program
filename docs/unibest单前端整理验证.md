# unibest 单前端整理验证

此文件为首次整理的历史快照；当前状态见 [Wot UI 与 UnoCSS 统一迁移验收](Wot-UI与UnoCSS统一迁移验收.md)。

日期：2026-10-16；当前分支：`codex/uniapp-multiplatform-plan`。

## 源码与入口

- 删除原生 `miniprogram/` 和早期 `experiments/p0-uniapp/`，唯一前端为 `apps/miniapp/`。
- 保留现有 `cloudfunctions/team/` 业务后端，以及诊断页仍使用的 `cloudfunctions/p0Health/`。
- 16 个 Vue 文件全部采用 `<script setup lang="ts">`；迁移页面生命周期、组件 props/emits 和响应式状态，移除旧 `this/setData` 适配。
- 新增共享业务类型；API 响应与 Pinia 草稿类型同步收窄。共享 JS 工具仍未启用 `checkJs`。
- 微信开发者工具根配置指向 `apps/miniapp/dist/build/mp-weixin/`。原本地模拟器配置删除并加入忽略。
- 原生搜一搜规则迁入 `src/static/sitemap.json`，已确认微信构建的 `app.json` 指向它且产物文件存在。
- 宣传素材脚本改读当前静态图片；HTTP 诊断脚本迁入新前端，旧阶段文档保留为历史记录。

## 自动验证

- 根目录 `node --test tests/*.test.js`：88 项通过。
- 前端 `npm --prefix apps/miniapp test`：33 项通过。
- `vue-tsc --noEmit` 严格类型检查通过。
- H5、微信、独立 QQ、支付宝、抖音五端构建通过。
- 本机默认文件监听遇到 `EMFILE`，使用 `CHOKIDAR_USEPOLLING=1 npm run check:matrix` 完成构建。保留现有工程配置。
- 构建仍有工具链 Sass legacy API 弃用提示。
- 静态图片引用核对无缺失，`git diff --check` 通过。

测试已从原生 Page/Component 桩迁到当前 Vue SFC：通过编译器执行真实 setup 和 Vue 响应式状态，替换宿主 API 与网络请求。服务端测试继续执行现有业务代码；旧 WXML/原生注册格式的断言不再使用。

## H5 浏览器验证

使用本地 H5 发布产物，在 375×812 视口检查：

- 欢迎说明显示正常，确认后隐藏并恢复底部导航。
- 从大厅切换至发车页正常。
- 选择 CS2 更新游戏字段；选择 3 小时更新结束时间和摘要。
- 未填房间/加入方式点击发车，显示必填提示并阻止提交。
- 最终浏览器控制台 0 错误、0 警告。

## 验证边界

没有执行生产云函数部署、真实业务写入、微信/QQ 真机回归或上传发布。订阅授权、聊天与朋友圈分享、微信原生选头像、真实发车上车，以及 QQ 服务端接入仍需要相应平台验收。本次没有提交或推送 Git。
