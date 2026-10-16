# Wot UI 与 UnoCSS 统一迁移验收

日期：2026-10-16。分支：`codex/uniapp-multiplatform-plan`。

## 本次完成

- 唯一前端仍为 `apps/miniapp`，11 个页面（10 个业务页面和接入诊断页）及公共组件统一使用 Wot UI 2.3.2。
- 所有 24 个 Vue 文件采用 `<script setup lang="ts">`。共享业务工具全部改为 TypeScript，开启严格检查并禁用 JS 输入。
- 页面只保留模板与组合函数入口，业务状态、生命周期和流程迁入 `src/composables`；管理统计、成员资料与队伍管理弹窗拆为公共组件。
- 删除旧 CSS、Vue style 块和行内样式。自有布局与视觉规则使用 UnoCSS utilities、shortcuts 和 preflight，品牌颜色及 Wot 主题集中于 `uno.config.ts`。
- 按当前 Wot 版本组合 `wd-cell` 和输入/选择器组件；单列选择器的数组值在公共入口转换为业务单值，日期选择器同步开始时间和结束时间。
- 页面提示、加载、确认和文本输入弹窗统一使用 Wot Toast/Dialog；保留取消确认时不发起写请求的行为。
- 多个弹层通过共享计数暂时隐藏原生底部导航，关闭最后一个弹层或组件卸载后恢复，解决小屏保存按钮遮挡。
- 移除 `getApplication`、dataset 事件、cloud/state 等旧页面适配层；业务 API 建立 action、参数和响应类型映射，并增加编译期错误契约检查。
- 接入 ESLint、Prettier、Husky 与 lint-staged，CI 上传前也执行代码和格式检查。本地已安装 Git hooks；新克隆安装依赖后执行 `npm run hooks:install`。

uni-app 的 `view/text/image/scroll-view/canvas`、路由和原生 tabBar 继续承担基础布局与平台能力；Wot 组件库自身的内部样式由依赖维护。分享封面的 Canvas 绘制不是页面 CSS，本次保留。未增加 layouts、alova、z-paging、Stylelint 或 commitlint。

## 本地验证

- 根目录业务、权限、头像、身份、分享等行为测试：96 项通过。
- 前端会话、页面行为和组件回归测试：37 项通过，包含时间跨日、弹层取消、选择器值转换和导航恢复。
- ESLint、Prettier、严格 vue-tsc（含请求契约检查）通过。
- 历史微信、QQ 构建与 H5 检查通过，记录见 [构建结果](migration-evidence/wot-unocss-build-results-2026-10-16.json)。
- 两个 GitHub 工作流通过 actionlint；Husky 已指向 `.husky/_`，提交前入口可运行。
- 静态扫描确认自有源码无 `.js/.css/.scss` 文件、Vue style 块、行内 style、旧 dataset/state/cloud 适配器及原生表单控件。

## H5 浏览器验证

使用本地生产构建和 Playwright：

- 320×568、375×812 查看欢迎信、发车表单和资料弹窗；品牌主题生效。
- 全部 11 个路由在 320 宽度无横向溢出，逐页检查无未捕获页面异常。详情缺少 ID 时显示链接不完整提示；管理端保留服务端权限校验。
- 平台选择能打开 Wot 弹层并回填值；开始时间确认正常；更多设置可展开。
- 发车时空加入方式显示“请填写房间 / 加入方式”，没有发送写请求。
- 欢迎信在小屏内完整显示并可确认；资料保存按钮可见，弹窗显示期间底部导航隐藏。
- 截图保存在本地忽略目录 `output/playwright/wot-*.png`。

H5 没有业务登录会话，空态和登录提示不代表线上数据。真实队伍列表、角色操作、资料保存、订阅消息、分享封面及平台原生输入能力仍需微信/QQ 开发工具与真机验收。本次没有上传、发布、部署云函数或改动生产数据。

## 后续边界

前端工程与 UI 统一迁移已经完成。QQ 后端的身份核验、会话、RPC 和头像接口仍需实现/部署，并配置真实 QQ AppID 与合法域名；这些不是引入 unibest 或 Wot UI 后自动获得的能力。现有工具链的依赖审计告警也不属于本次 UI 迁移修复范围，详见 `apps/miniapp/UNIBEST.md`。
