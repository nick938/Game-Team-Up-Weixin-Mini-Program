# pnpm workspace 整理与验证

日期：2026-10-16。

## 工程结构

- 根目录固定 Node.js 24、pnpm 10.34.5，统一工作区为 `apps/miniapp` 与 `tools/miniapp-release`。
- 前端和上传工具原有 npm 锁文件转换为根 `pnpm-lock.yaml`，直接依赖版本保持原有声明。
- 云函数不加入工作区，继续保留自己的依赖声明及微信云端安装、部署方式。
- Husky / lint-staged 移至根开发依赖，通过 pnpm 命令解析工具；测试与微信上传 SDK 继续从所属包解析依赖。
- CI、上传构建及五端检查脚本统一调用 pnpm，CI 使用冻结锁文件安装。
- 本地旧的未跟踪 pnpm 配置和旧 node_modules 临时备份于 `/tmp/game-team-pnpm-migration`，未纳入仓库。

## 本地验证

- 移走旧 node_modules 后，根目录 `pnpm install --frozen-lockfile` 全新安装通过；调整依赖初始化许可后再次冻结安装通过。
- 根目录 `pnpm check` 与 `pnpm check:matrix` 通过：仓库测试 96 项、前端测试 37 项，ESLint、Prettier、严格类型检查和 H5 / 微信 / QQ / 支付宝 / 抖音构建。
- 根目录 `pnpm release:plan` 能列出两端；微信 `release:build` 以本次覆盖版本 1.8.5 构建并校验产物身份，源码默认版本仍为 1.8.4。
- 微信 miniprogram-ci SDK 可从上传工具包正常加载；未调用真实上传。
- 临时 Git 仓库中运行实际 pre-commit 脚本，成功执行前端 ESLint 与 Prettier，并将修复结果写回临时暂存区；未改变本仓库暂存区。
- actionlint 与 `git diff --check` 通过。
- 当前受限环境文件监听需要 `CHOKIDAR_USEPOLLING=1 pnpm dev`；H5 开发服务可以启动，首页与 `/src/main.ts` 均返回 HTTP 200，验证后已停止服务。

## 验证边界

本次只调整包管理和工程命令，未改页面业务。未执行 Git 提交/推送、远端 Actions、平台上传、提审、正式上线或生产云函数部署。多端编译不代替微信与 QQ 真机业务验收。
