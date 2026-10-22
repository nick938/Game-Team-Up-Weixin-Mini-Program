# HTTP 探测函数 p0Health

用于检查 HTTP 网关与云函数的传输链路，不提供用户登录、数据库访问或组队业务。

## 行为

- GET `/p0/health` 或网关移除前缀后的 `/` 返回 `{"ok":true,"service":"game-team-p0","version":"p0-health-v1"}`；HEAD 返回 200 和空响应体，写方法拒绝。
- 无运行依赖，不访问数据库、云存储、邮件或其他云函数，不回显请求参数、请求头或身份信息。
- CORS 仅允许 `http://127.0.0.1:5187`，不允许携带凭据；无 Origin 的请求可读取固定响应。CORS 不作为鉴权。

## 检查

在仓库根目录检查本地函数行为：

```sh
node --test tests/p0-health.test.js
```

检查已部署的独立探测路由：

```sh
pnpm --filter game-team-miniapp check:http https://测试域名/p0/health
```

脚本检查 GET、HEAD、写方法拒绝、CORS、OPTIONS 和未知路径，报告写入 `apps/miniapp/dist/p0/http-results.json`。此探测保留为命令行工具，不在小程序内提供诊断页面。

探测成功仅代表传输可用，不代表 QQ 登录或业务接入完成。此函数与 `team` 业务入口独立。
