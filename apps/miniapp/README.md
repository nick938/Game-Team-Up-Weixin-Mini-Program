# 开黑星球 · uni-app 前端

本地迁移工程：微信回归 + **独立 QQ 小程序**优先。使用裁剪后的 unibest 工程配置、uni-app / Vue 3 / TypeScript / Vite / UnoCSS / Pinia / Wot UI。模板来源和裁剪见 [UNIBEST.md](UNIBEST.md)。

## 开发和检查

```sh
cd apps/miniapp
npm ci --ignore-scripts
npm run dev:h5 -- --port 5196
npm run check:matrix
```

`check:matrix` 顺序执行本地行为测试、类型检查和 H5/微信/QQ/支付宝/抖音编译，输出 `dist/p0/build-results.json`。在受限文件监听环境中可加 `CHOKIDAR_USEPOLLING=1` 运行命令。本仓库根目录的原生业务回归仍为 `node --test tests/*.test.js`。

- 微信产物：`dist/build/mp-weixin/`，导入微信开发者工具；使用现有微信 AppID 与云函数环境。
- QQ 产物：`dist/build/mp-qq/`，后续导入 QQ 开发工具；需要独立 QQ AppID、服务端配置及合法域名。
- H5 主要用于前端检查。不提供假登录或自动读取生产业务的旁路；没有业务会话时不能把空列表当作线上数据。

## 当前已迁移

10 个原页面和原路由：大厅、游戏页、发车、我的、详情、协议、反馈、报错、举报、管理端。4 个主要组件：队伍卡片、资料填写、欢迎信、朋友圈单页提示。保留游戏目录、分页/排序、日期时长规则、必填加入方式、密码可见提示、代开和管理员交互。

微信使用集中适配的现有 `team` 云调用；QQ 使用 `uni.login` 取得宿主 code，再调用 HTTPS 登录/业务接口。QQ 不初始化 `wx.cloud`、不复用微信订阅模板、不使用微信专用头像按钮；使用跨端选图和手填昵称。

## QQ 接入契约和未完成项

复制 `.env.example` 为 `.env.local`：

```dotenv
VITE_QQ_APP_ID=独立QQ小程序AppID
VITE_API_BASE_URL=https://你的测试API域名
```

这些是公开构建配置，不放 AppSecret、登录 code 或 token。当前尚无 QQ 账号/AppID，不能执行真实登录、真机运行或发布验收。

客户端已经准备以下 **待后端实现/部署的兼容接口**，并非现有线上 API：

| 接口 | 输入 | 输出与约束 |
| --- | --- | --- |
| `POST /v1/auth/qq` | `{code}` | 后端向 QQ 核验后返回 `{ok:true, accessToken, expiresAt}`；expiresAt 为毫秒时间戳 |
| `POST /v1/rpc` | `{action,input}` + Bearer 会话 | 兼容现有 action 的临时桥接契约；服务端白名单、统一 actor 和权限校验；不可直接暴露旧 team 入口 |
| `POST /v1/media/avatar` | multipart file + Bearer 会话 | 校验归属、大小、格式和内容后返回 `{ok:true,fileID}`；资料接口再返回可读 HTTPS 展示地址 |

会话只在内存保存，临近过期重新登录；401 清除会话，写操作不自动重放。现有服务端身份模块还只是独立基础实现，未接入生产入口。跨端共享用户/队伍、内容检测、头像上传和通知需要后端统一身份改造后才能业务闭环；仅填 API 域名不会让这些接口自动存在。

## 验收层级

本地测试/类型检查/多端编译、H5 浏览器交互、微信真机回归、QQ 真机业务验收分别记录。当前构建成功不能作为 QQ 正常登录、共用大厅或跨端上车已完成的证据。

后续优先完成隔离资源上的后端身份映射、会话和业务接口，再配置 QQ AppID/域名，执行两个真实账号的发车、跨端加入、密码/角色校验和头像互看。当前不迁生产数据。

## 2026-10-16 本地验证记录

- 根目录业务/头像/身份/探测测试：121 项通过；新前端会话和迁移行为测试：10 项通过。
- 类型检查通过，包含 API、Pinia、资料组件、页面模板与工程配置；旧 JS 的 checkJs 未开启，不能据此宣称旧业务已全部类型化。
- H5、微信、独立 QQ、支付宝、抖音五端构建通过；完整结果位于 `docs/p0-evidence/miniapp-build-results-2026-10-16.json`。
- H5 发布产物在 375×812 浏览器检查：欢迎说明已读持久化、切页后不重复出现；大厅未登录错误提示、路由跳转、游戏选择、时长更新、加入方式必填和底部按钮可点击；最终控制台 0 错误、0 警告。
- 修复了迁移中 H5 底部导航遮挡发车按钮，以及 uni 命名空间别名导致编译漏掉存储等 API 的问题。页面行为仍需微信与 QQ 真机继续回归。
- 依赖审计仍有已知安全告警（含工具链 c12/giget 引入的 tar）；当前是本地迁移版本，未完成生产发布前的依赖升级审计，详见 UNIBEST.md。
