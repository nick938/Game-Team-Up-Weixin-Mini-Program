import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist/p0');
mkdirSync(output, { recursive: true });
const jobs = [
  'lint',
  'format:check',
  'test',
  'typecheck',
  'build:h5',
  'build:weixin',
  'build:qq',
  'build:alipay',
  'build:toutiao',
];
const results = [];

// 顺序运行避免多个 uni 编译进程共享临时文件；某端失败仍继续收集其他端结果。
for (const job of jobs) {
  const start = Date.now();
  const run = spawnSync('npm', ['run', job], { cwd: root, encoding: 'utf8' });
  const logName = `${job.replaceAll(':', '-')}.log`;
  writeFileSync(path.join(output, logName), `${run.stdout || ''}\n${run.stderr || ''}\n${run.error || ''}`);
  const result = {
    job,
    passed: run.status === 0,
    exitCode: run.status,
    elapsedMs: Date.now() - start,
    log: logName,
  };
  results.push(result);
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${job} (${result.elapsedMs}ms)`);
}

const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
writeFileSync(
  path.join(output, 'build-results.json'),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      nodeVersion: process.version,
      dependencies: manifest.dependencies,
      scope:
        'typecheck and compilation only; no platform login, business API, cloud persistence or release verified',
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log('结果：apps/miniapp/dist/p0/build-results.json');
process.exitCode = results.every((result) => result.passed) ? 0 : 1;
