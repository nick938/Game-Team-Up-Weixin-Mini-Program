// 隔离的 HTTP 链路探测：不加载云 SDK，不访问数据库、存储或其他业务函数。
const ALLOWED_ORIGIN = "http://127.0.0.1:5187";
const HEALTH = Object.freeze({ ok: true, service: "game-team-p0", version: "p0-health-v1" });

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
    body: body === null ? "" : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

exports.main = async (event) => {
  if (!event || typeof event !== "object" || typeof event.httpMethod !== "string") {
    return response(400, { ok: false, code: "HTTP_EVENT_REQUIRED" });
  }
  // 不接受定时任务或业务操作入口；这些字段无论与何种 method 组合都不能触发其他行为。
  if (event.TriggerName || event.Type === "Timer" || event.type) {
    return response(400, { ok: false, code: "UNSUPPORTED_EVENT" });
  }
  const pathname = typeof event.path === "string" ? event.path : "/";
  // 网关可能去掉 /p0/health 前缀，也可能将它透传。
  if (pathname !== "/" && pathname !== "/p0/health") {
    return response(404, { ok: false, code: "NOT_FOUND" });
  }
  const origin = Object.entries(event.headers || {}).find(([name]) => name.toLowerCase() === "origin")?.[1];
  const cors = origin === ALLOWED_ORIGIN
    ? { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, Vary: "Origin" }
    : { Vary: "Origin" };

  if (event.httpMethod === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) return response(403, { ok: false, code: "ORIGIN_NOT_ALLOWED" });
    const requestedMethod = Object.entries(event.headers || {}).find(([name]) => name.toLowerCase() === "access-control-request-method")?.[1];
    if (requestedMethod && !["GET", "HEAD"].includes(requestedMethod)) {
      return response(405, { ok: false, code: "METHOD_NOT_ALLOWED" }, { ...cors, Allow: "GET, HEAD, OPTIONS" });
    }
    return response(204, null, { ...cors, "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS" });
  }
  if (!["GET", "HEAD"].includes(event.httpMethod)) {
    return response(405, { ok: false, code: "METHOD_NOT_ALLOWED" }, { ...cors, Allow: "GET, HEAD, OPTIONS" });
  }
  return response(200, event.httpMethod === "HEAD" ? null : HEALTH, cors);
};
