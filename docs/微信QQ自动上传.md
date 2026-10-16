# 微信 / QQ 自动构建与上传

本仓库使用 GitHub Actions 编排，微信接官方 `miniprogram-ci`，QQ 接官方 `qqminiapp/build` Docker 镜像。`Miniapp Upload` 只上传开发版本；QQ 可额外设置体验版。暂不提交审核、不正式上线、不部署云函数。

## 配置一次，以后批量运行

### 1. 将工作流放到 GitHub 默认分支

提交并推送根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` 以及 `.github/workflows/miniapp-ci.yml` 和 `miniapp-upload.yml`。手动运行入口需要上传工作流先存在于默认分支；之后可以在 Run workflow 的分支选择器选择待上传分支。

`Miniapp CI` 在相关代码 push / PR 时执行：服务端与页面测试、类型检查，以及独立工作区内的微信 / QQ 编译。此流程不使用上传凭据，QQ 未注册 AppID 也可进行编译检查。

### 2. 配置 GitHub Environments

进入仓库 Settings → Environments，分别创建以下环境；私钥和令牌在 GitHub 页面配置，不放进源码、不通过聊天传递。

| Environment | 类型 | 名称 | 内容 |
| --- | --- | --- | --- |
| `miniapp-weixin` | Variable | `APP_ID` | 微信 AppID；留空使用清单现有 AppID |
| `miniapp-weixin` | Secret | `WEIXIN_UPLOAD_PRIVATE_KEY` | 微信代码上传私钥的完整文本（保留 PEM 换行），不是 AppSecret |
| `miniapp-qq` | Variable | `APP_ID` | 独立 QQ 小程序 AppID，必填 |
| `miniapp-qq` | Variable | `API_BASE_URL` | 已部署的 QQ HTTPS 业务 API，必填；不是 `/p0/health` |
| `miniapp-qq` | Secret | `QQ_APP_TOKEN` | QQ 管理后台 → 设置 → 开发设置生成的 appToken |
| `miniapp-qq` | Variable | `QQ_CI_IMAGE` | 可选；默认使用已核对的官方 Linux amd64 镜像 digest，支持覆盖为官方镜像 tag 或 digest |

QQ 的业务 API 将在腾讯云 CloudBase 控制台创建的新环境中实现并部署 `/v1/auth/qq`、`/v1/rpc` 和 `/v1/media/avatar`，先完成 QQ 小程序账号与腾讯云账号绑定。`API_BASE_URL` 填该新环境已部署的 HTTPS 业务入口，不填旧微信环境 ID 或探测地址；后端与数据迁移见 [迁移计划](微信QQ迁移与发布计划.md)。仅填一个域名不会完成业务接入。现在可以先使用微信上传，QQ 配置齐全并完成真机验收后再选 QQ。

### 3. 微信 IP 白名单与上传 runner

微信管理员在公众平台下载代码上传密钥，并将上传机器出口 IP 配入白名单。普通 GitHub 托管 runner 的出口地址不固定，不应把它当作固定 IP 机器。

如果已有固定出口的 Linux 主机，可注册 GitHub self-hosted runner 并增加 `miniapp-upload` 标签，在仓库 **Variables** 中配置：

```text
MINIAPP_UPLOAD_RUNNER=["self-hosted","linux","x64","miniapp-upload"]
```

该值是 JSON，不能直接填一串未加引号的标签。上传 runner 需要支持当前 Actions 的 Node 24 运行时，能访问 GitHub/npm registry/对应平台；QQ 还需要已启动的 Docker，容器以 Linux amd64 运行。CI 测试始终使用 GitHub 托管 runner。未配置该变量时，上传默认运行在 `ubuntu-latest`，微信是否可上传取决于其实际出口和后台 IP 配置。

## 日常使用

打开仓库 Actions → **Miniapp Upload** → **Run workflow**：

- `targets`：`weixin`、`qq`、`all`，也支持应用 ID 逗号分隔。
- `version`：例如 `1.8.5`；留空使用 `apps/miniapp/package.json` 的版本。允许填 `v1.8.5`，会归一化。
- `description`：本次更新说明。
- `qq_experience`：是否将 QQ 上传版本设为体验版，默认关闭。

流程先验证应用选择和版本，运行全部测试及类型检查，然后按应用并行执行配置校验、构建、保存产物和上传。缺少凭据/AppID/QQ API 时提前失败；一个应用失败不取消其他应用。同一个应用的上传任务串行执行；GitHub concurrency 只保留一个 pending 任务，因此不要把它作为无限发布队列。

每个上传任务的 Summary 显示应用、版本和结果；Artifacts 保存本次上传使用的包及不含密钥的回执。失败可选择 **Re-run failed jobs** 重试；平台上传不是幂等事务，如超时应先到后台确认版本是否已上传，再决定重试。

QQ 官方容器正常输出可能包含体验版入口；当前脚本不转发容器原始日志，以免原始错误暴露 appToken。体验入口在 QQ 管理端查看。微信上传后也到对应后台查看开发版本，后续提审与上线独立操作。

## 增加更多应用

编辑 `scripts/miniapp/apps.json`，例如增加第二个微信应用：

```json
{
  "id": "weixin-second",
  "name": "第二个微信小程序",
  "platform": "weixin",
  "environment": "miniapp-weixin-second",
  "appid": ""
}
```

为新环境设置 `APP_ID` 和独立私钥后，可通过 `weixin-second` 单独上传，`weixin` 上传所有微信应用，`all` 上传全部。任务按应用 ID 隔离，构建时重新注入对应 AppID，并在上传前核对产物元数据，避免串包。

应用清单解决发布目标管理，不会自动改造业务身份、云环境或品牌内容。同一代码要面向不同业务实例时，还需明确这些运行配置。

## 版本与本地验证

本地与 CI 使用根 `packageManager` 固定的 pnpm 10.34.5、Node.js 24 和根 `pnpm-lock.yaml`。所有命令在仓库根目录执行。CI 使用 `pnpm install --frozen-lockfile`，不在各子目录分别安装。云函数仍独立部署，不纳入工作区。

`apps/miniapp/package.json` 是默认版本来源；`MINIAPP_VERSION` 仅对本次构建覆盖。Vite 注入 `__APP_VERSION__`，同时写入 manifest 和上传元数据，上传使用同一版本。无需再修改 `src/utils/constants.js`。

无密钥查看发布计划：

```sh
MINIAPP_TARGETS=all pnpm release:plan
```

只构建微信上传包（不上传）：

```sh
MINIAPP_TARGETS=weixin MINIAPP_VERSION=1.8.5 pnpm release:build
```

本地实际上传需配置环境变量：微信为 `WEIXIN_UPLOAD_PRIVATE_KEY`；QQ 为 `MINIAPP_APP_ID`、`MINIAPP_API_BASE_URL`、`QQ_APP_TOKEN`，并启动 Docker。在仓库根目录执行 `pnpm install --frozen-lockfile` 会同时安装锁定的微信上传 SDK，无需单独安装。不要把密钥直接写入命令历史。随后运行 `MINIAPP_TARGETS=weixin pnpm release:upload`。

## 官方依据

- [微信 miniprogram-ci](https://github.com/wechat-miniprogram/miniprogram-ci-dist)：Project、upload、私钥和 IP 白名单。
- [QQ 小程序 CI](https://q.qq.com/wiki/tools/ci/)：官方 Docker 镜像、appToken、PLUGIN_* 参数及体验版。
- [GitHub 手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)：workflow_dispatch 的默认分支要求。

本次代码实现不代表 GitHub Actions 已运行，也不代表任一平台已实际接受上传。首次上传需配置上述环境并在平台后台确认。

## 本次实现验证（2026-10-16）

- 根目录测试 96 项、前端测试 33 项通过，其中 8 项专门覆盖发布选择、缺少配置、凭据传参和产物身份校验。
- 严格类型检查、actionlint 1.7.12 工作流检查通过。
- 微信与 QQ 上传包构建通过，验证本次版本覆盖为 `1.8.5`；QQ 使用仅供编译的测试 AppID 和 `.invalid` API 地址，没有将它们写入应用清单或 GitHub 配置。
- H5 默认版本构建通过；微信官方 SDK 可加载，独立上传工具的 npm lockfile 经离线 dry-run 校验。
- 已只读查询官方 QQ 容器的 Linux amd64 manifest，并固定默认 digest。本机 Docker daemon 未运行，未执行真实容器上传。
- 没有配置 GitHub Secrets、推送工作流、触发远端 Actions、调用平台上传、提审或正式上线。真实上传成功仍需后续平台验收。
