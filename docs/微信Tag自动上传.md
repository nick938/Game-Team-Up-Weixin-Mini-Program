# 微信 Tag 自动构建与上传

当前 GitHub Actions 只检查、构建和上传微信小程序，QQ 本地代码与命令保留，Actions 不运行 QQ。

## 流程

- 普通分支 push / PR：测试、lint、格式、类型检查和微信构建，不上传。
- 推送 `vX.Y.Z` Tag：校验版本 → 完整检查 → 微信构建 → 保存上传包 → 上传开发版本 → 保存回执。
- 保留 Actions → **WeChat Upload** → **Run workflow** 手动上传入口，仍只上传微信。

**上传开发版本不等于提交审核或正式上线。** 上传成功后，需要在微信公众平台「版本管理」确认对应开发版本并提交审核；审核通过后的正式上线也是独立操作。自动提审需另行确认微信账号的审核接口授权能力，本工作流没有假定已具备该权限，也不会模拟提审成功。

云函数不在此流程中部署。涉及后端变更时，先部署对应云函数并验收兼容性，再上传、提审小程序。

## 一次性配置

GitHub 仓库 Settings → Environments 创建 `miniapp-weixin`：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Variable | `APP_ID` | 微信 AppID；留空使用应用清单中的 AppID |
| Secret | `WEIXIN_UPLOAD_PRIVATE_KEY` | 微信公众平台下载的代码上传私钥，完整保留 PEM 换行；不是 AppSecret |

私钥只配置在 GitHub Secrets，不写入仓库或命令历史。

微信管理员还需配置上传机器出口 IP 白名单。GitHub 普通托管 runner 的出口不固定；可使用固定出口的 self-hosted runner，在仓库 Variables 配置：

```text
MINIAPP_UPLOAD_RUNNER=["self-hosted","linux","x64","miniapp-upload"]
```

该变量是 JSON。未配置时使用 `ubuntu-latest`，实际能否上传仍取决于出口 IP 和微信后台配置。Runner 需要支持 Node.js 24、pnpm 和相应网络访问；不再需要 QQ 凭据或 Docker。

## 发布一个版本

1. 完成代码修改、真机验收；同步 `apps/miniapp/package.json` 和 `apps/miniapp/src/utils/changelog.ts` 最新记录的版本。
2. 更新 `src/utils/updates.ts` 的公告内容，新增公告使用新 `id`；同步仓库 `CHANGELOG.md`。确认上传包包含预期的云环境和配置。
3. 提交并推送代码，然后针对该提交创建并推送版本 Tag。例如以下命令会触发真实上传，仅在准备发布时运行：

```sh
git tag -a v1.8.5 -m "Release 1.8.5"
git push origin v1.8.5
```

仅在本地创建 Tag 不会触发 Actions。正式 Tag 必须是 `vX.Y.Z`，不接受 beta、前导零或与代码/最新日志不一致的版本。示例中的 `1.8.5` 需先同步到对应代码和日志，不能直接对当前旧版本打这个 Tag。

Tag 是自动上传版本号的来源，`MINIAPP_VERSION` 会在构建时注入 manifest、界面版本和产物元数据；上传前再次校验 AppID、平台、版本和应用 ID。手动上传留空版本时使用代码版本，显式填写也必须与代码和最新日志一致。

## 结果与失败处理

- Actions Summary 明确记录上传状态以及「尚未提交审核或上线」。Artifacts 保存当次编译包和不含密钥的上传回执。
- 同一微信应用的上传串行执行，不取消进行中的上传。GitHub concurrency 不是无限队列，不要连续推多个发布 Tag 排队。
- 上传超时后先到微信后台核对是否已经收到对应版本，再决定是否重试，避免把响应丢失误判为没有上传。
- 不通过删除、移动旧发布 Tag 来重发不同代码；修复后使用新版本。
- 工作流提交、静态检查和本地构建通过，都不等于 GitHub 上已经执行上传或微信已经接受提审。

## 本地检查

仓库使用 Node.js 24 和根 `packageManager` 指定的 pnpm。安装依赖后执行 `pnpm check`；不需要密钥即可运行：

```sh
node scripts/miniapp/wechat-plan.mjs
MINIAPP_TARGETS=weixin pnpm release:build
```

第一条只打印发布计划；第二条只构建，不上传。
