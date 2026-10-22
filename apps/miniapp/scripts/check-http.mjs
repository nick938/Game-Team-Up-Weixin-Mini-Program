import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rawURL = process.argv[2];
if (!rawURL) throw new Error('用法：pnpm run check:http https://测试域名/p0/health');
const endpoint = new URL(rawURL);
if (
  endpoint.protocol !== 'https:' ||
  endpoint.pathname !== '/p0/health' ||
  endpoint.username ||
  endpoint.password ||
  endpoint.search ||
  endpoint.hash
) {
  throw new Error('只接受不含凭据和查询参数的 HTTPS /p0/health 地址');
}
const localOrigin = 'http://127.0.0.1:5187';
const cases = [
  {
    name: 'GET constant response',
    method: 'GET',
    status: 200,
    expected: { ok: true, service: 'game-team-p0', version: 'p0-health-v1' },
  },
  { name: 'HEAD no body', method: 'HEAD', status: 200 },
  { name: 'POST rejected', method: 'POST', status: 405, expectedCode: 'METHOD_NOT_ALLOWED' },
  {
    name: 'Local preview CORS',
    method: 'GET',
    status: 200,
    headers: { Origin: localOrigin },
    cors: localOrigin,
  },
  {
    name: 'Local read preflight',
    method: 'OPTIONS',
    status: 204,
    headers: { Origin: localOrigin, 'Access-Control-Request-Method': 'GET' },
    cors: localOrigin,
  },
  {
    name: 'Unknown subpath rejected',
    method: 'GET',
    status: 404,
    suffix: '/missing',
    expectedCode: 'NOT_FOUND',
  },
];
const results = [];
for (const entry of cases) {
  try {
    const response = await fetch(endpoint.href + (entry.suffix || ''), {
      method: entry.method,
      headers: entry.headers,
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();
    const json = body ? JSON.parse(body) : null;
    const matched =
      !entry.expected ||
      (Object.keys(json || {}).length === Object.keys(entry.expected).length &&
        Object.entries(entry.expected).every(([key, value]) => json[key] === value));
    const passed =
      response.status === entry.status &&
      matched &&
      (!entry.expectedCode || json?.code === entry.expectedCode) &&
      (!entry.cors || response.headers.get('access-control-allow-origin') === entry.cors) &&
      (!['HEAD', 'OPTIONS'].includes(entry.method) || body === '') &&
      response.headers.get('access-control-allow-credentials') !== 'true';
    results.push({
      name: entry.name,
      passed,
      expectedStatus: entry.status,
      status: response.status,
      requestId: response.headers.get('x-cloudbase-request-id'),
      response: json,
      corsOrigin: response.headers.get('access-control-allow-origin'),
    });
  } catch (error) {
    results.push({ name: entry.name, passed: false, error: String(error.message) });
  }
  console.log(`${results.at(-1).passed ? 'PASS' : 'FAIL'} ${entry.name}`);
}
const output = fileURLToPath(new URL('../dist/p0/', import.meta.url));
mkdirSync(output, { recursive: true });
writeFileSync(
  path.join(output, 'http-results.json'),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      endpoint: endpoint.href,
      scope: 'public HTTP transport only; no platform login or business data',
      results,
    },
    null,
    2,
  ) + '\n',
);
process.exitCode = results.every((result) => result.passed) ? 0 : 1;
