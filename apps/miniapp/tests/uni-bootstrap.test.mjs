import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('uni startup creates a missing manifest and refreshes stale configuration before the CLI runs', () => {
  const app = fileURLToPath(new URL('../', import.meta.url));
  const root = mkdtempSync(join(tmpdir(), 'game-team-uni-bootstrap-'));
  try {
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'scripts'));
    for (const file of ['package.json', 'manifest.config.ts', 'scripts/uni.mjs']) {
      cpSync(join(app, file), join(root, file));
    }
    symlinkSync(join(app, 'node_modules'), join(root, 'node_modules'), 'junction');
    for (const stale of [false, true]) {
      if (stale) writeFileSync(join(root, 'src/manifest.json'), '{"versionName":"0.0.0"}');
      const result = spawnSync(process.execPath, ['scripts/uni.mjs', '--help'], {
        cwd: root,
        env: {
          ...process.env,
          MINIAPP_VERSION: '1.8.5',
          VITE_WEIXIN_APP_ID: 'wxa111111111111111',
          VITE_QQ_APP_ID: '1234567890',
        },
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const manifest = JSON.parse(readFileSync(join(root, 'src/manifest.json'), 'utf8'));
      assert.equal(manifest.versionName, '1.8.5');
      assert.equal(manifest['mp-weixin'].appid, 'wxa111111111111111');
      assert.equal(manifest['mp-qq'].appid, '1234567890');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
