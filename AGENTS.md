<!-- open-wot agent instructions start -->

## Wot UI Agent Instructions

Before generating or modifying wot-ui component code, read the project Skill at `.agents/skills/wot-ui-v2/SKILL.md` and query the configured `wot-ui` MCP server for version-accurate APIs and examples.

<!-- open-wot agent instructions end -->

## 小程序分享规则

- `onShareAppMessage`、`onShareTimeline` 必须在对应页面 `.vue` 的 `<script setup>` 中直接调用注册。composable 只返回分享处理函数，不能仅在 composable、子组件或异步生命周期中注册这两个页面事件。
- uni-app 按页面源码生成原生 `__runtimeHooks`。分享函数单测通过不代表微信页面已经注册事件；漏注册时微信会回退当前页面截图。
- 微信和 QQ 构建必须执行 `apps/miniapp/scripts/check-share-hooks.mjs` 并通过。新增分享页面需同步加入检查清单，不能移除检查或绕过失败。
- 大厅转发与车辆详情分享共用车辆标题、详情路径和信息图；原生分享按钮使用 `open-type="share"` 与公开车辆标识，不能把房间号、密码或内部身份放进按钮数据/封面。
- 分享画布由页面直接持有，不放在自定义组件插槽内；绘图失败保留安全兜底，异步生成封面时保持同一辆车的标题和路径。
- 修改分享必须分别验证数据回归、原生构建注册标记和体验版真机行为。未做真机测试时明确说明，不得用H5截图或模拟回调宣称真机问题已解决。

## 页面与文档维护

- 删除页面前核对页面注册、TabBar、角色入口、动态导航、分享和搜索落地；不能只按静态菜单是否出现判断无入口。
- 当前产品规则统一维护 `docs/产品需求.md`，维护与部署步骤维护 `docs/维护与验收.md`；完成的临时实施/设计清单归并后移除，清理相应引用，不保留互相矛盾的重复说明。
