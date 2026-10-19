const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const library = import('../scripts/miniapp/release.mjs');
const wechatPlan = import('../scripts/miniapp/wechat-plan.mjs');
const apps = [
  { id: 'wechat-a', platform: 'weixin', environment: 'miniapp-wechat-a', appid: 'wx0123456789abcdef' },
  { id: 'qq-a', platform: 'qq', environment: 'miniapp-qq-a', appid: '' },
  { id: 'qq-b', platform: 'qq', environment: 'miniapp-qq-b', appid: '' },
];

test('WeChat tags drive the release version and reject mismatched code or notes', async () => {
  const { wechatReleaseVersion } = await wechatPlan;
  const event = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/v1.8.5', MINIAPP_VERSION: '9.9.9' };
  assert.equal(wechatReleaseVersion(event, '1.8.5', '1.8.5'), '1.8.5');
  assert.throws(() => wechatReleaseVersion(event, '1.8.4', '1.8.5'), /必须一致/);
  assert.throws(() => wechatReleaseVersion(event, '1.8.5', '1.8.4'), /必须一致/);
  for (const ref of ['refs/heads/main', 'refs/tags/v01.8.5', 'refs/tags/v1.8.5-beta', 'refs/tags/v1.8.5\nanything=1', 'refs/tags/v1.8.5$(id)']) {
    assert.throws(() => wechatReleaseVersion({ ...event, GITHUB_REF: ref }, '1.8.5', '1.8.5'));
  }
  assert.equal(wechatReleaseVersion({ GITHUB_EVENT_NAME: 'workflow_dispatch' }, '1.8.5', '1.8.5'), '1.8.5');
  assert.throws(() => wechatReleaseVersion({ GITHUB_EVENT_NAME: 'pull_request' }, '1.8.5', '1.8.5'));
});

test('release selection supports platforms and explicit app IDs without silently dropping typos', async () => {
  const { selectApps } = await library;
  assert.deepEqual(selectApps('qq', apps).map(app => app.id), ['qq-a', 'qq-b']);
  assert.deepEqual(selectApps('wechat-a,qq-b', apps).map(app => app.id), ['wechat-a', 'qq-b']);
  assert.equal(selectApps('all', apps).length, 3);
  assert.throws(() => selectApps('qq,typo', apps), /未知/);
  assert.throws(() => selectApps('all', [apps[0], apps[0]]), /重复/);
  assert.throws(() => selectApps('', apps), /未知/);
});

test('release version is canonical and rejects shell syntax, line breaks and invalid components', async () => {
  const { releaseVersion } = await library;
  assert.equal(releaseVersion('v1.8.5'), '1.8.5');
  assert.equal(releaseVersion(''), require('../apps/miniapp/package.json').version);
  for (const value of ['01.2.3', '1.2', '1.2.3-beta', '1000.0.0', '1.2.3\ninjected=1', '$(id)']) {
    assert.throws(() => releaseVersion(value));
  }
});

test('QQ requires its own AppID and a business HTTPS API; WeChat keeps its configured ID', async () => {
  const { releaseConfig } = await library;
  assert.equal(releaseConfig(apps[0], {}).appid, apps[0].appid);
  assert.throws(() => releaseConfig(apps[1], {}), /APP_ID/);
  const env = { MINIAPP_APP_ID: '1234567890', MINIAPP_API_BASE_URL: 'https://api.example.com' };
  assert.equal(releaseConfig(apps[1], env).appid, env.MINIAPP_APP_ID);
  for (const url of ['', 'http://api.example.com', 'https://x/p0/health', 'https://user:pass@x', 'https://x?token=x']) {
    assert.throws(() => releaseConfig(apps[1], { ...env, MINIAPP_API_BASE_URL: url }), /API_BASE_URL/);
  }
});

test('missing credentials fail before invoking the platform SDK or Docker', async () => {
  const { checkCredentials } = await library;
  assert.throws(() => checkCredentials(apps[0], {}), /WEIXIN_UPLOAD_PRIVATE_KEY/);
  assert.throws(() => checkCredentials(apps[1], {}), /QQ_APP_TOKEN/);
  assert.throws(() => checkCredentials(apps[1], { QQ_APP_TOKEN: 'token', QQ_EXPERIENCE: 'yes' }), /true/);
});

test('uploader refuses a different app, version or platform artifact', async t => {
  const { checkArtifact } = await library;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'miniapp-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = { ...apps[0], version: '1.8.5' };
  fs.writeFileSync(path.join(directory, 'project.config.json'), JSON.stringify({ appid: config.appid }));
  fs.writeFileSync(path.join(directory, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }));
  fs.writeFileSync(path.join(directory, 'app.js'), '');
  fs.writeFileSync(path.join(directory, 'release-metadata.json'), JSON.stringify(config));
  assert.equal(checkArtifact(config, directory), directory);
  for (const patch of [{ appid: 'wx1111111111111111' }, { version: '1.8.6' }, { platform: 'qq' }, { id: 'wechat-b' }]) {
    assert.throws(() => checkArtifact({ ...config, ...patch }, directory), /不一致/);
  }
});

test('QQ Docker passes token through the environment and mounts only the selected package', async () => {
  const { qqInvocation } = await library;
  const config = { version: '1.8.5', description: '修复 `$(id)`' };
  const result = qqInvocation(config, '/tmp/package', { QQ_APP_TOKEN: 'secret-value', QQ_EXPERIENCE: 'true' });
  assert.ok(!result.args.join(' ').includes('secret-value'));
  assert.equal(result.env.PLUGIN_APPTOKEN, 'secret-value');
  assert.equal(result.env.PLUGIN_EXPERIENCE, 'true');
  assert.equal(result.env.PLUGIN_SOURCECODEPATH, '.');
  assert.ok(result.args.includes('type=bind,src=/tmp/package,dst=/workspace'));
  assert.equal(result.env.PLUGIN_DESC, config.description);
  assert.throws(() => qqInvocation(config, '/tmp/package', { QQ_CI_IMAGE: 'untrusted/image:latest' }));
});

test('WeChat receives the intended package/version/key and never triggers cloud deployment or audit', async () => {
  const { uploadWechat } = await library;
  let projectOptions, uploadOptions;
  const sdk = { Project: class { constructor(options) { projectOptions = options; } }, upload: async options => { uploadOptions = options; } };
  await uploadWechat({ appid: apps[0].appid, version: '1.8.5', description: '修复' }, '/tmp/package', { WEIXIN_UPLOAD_PRIVATE_KEY: 'fake-test-key' }, sdk);
  assert.equal(projectOptions.privateKey, 'fake-test-key');
  assert.equal(projectOptions.projectPath, '/tmp/package');
  assert.equal(uploadOptions.version, '1.8.5');
  assert.equal(uploadOptions.setting.useProjectConfig, true);
});

test('QQ artifact validation reads qqappid instead of the WeChat appid field', async t => {
  const { checkArtifact } = await library;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = { ...apps[1], appid: '1234567890', version: '1.8.5' };
  fs.writeFileSync(path.join(directory, 'project.config.json'), JSON.stringify({ qqappid: config.appid }));
  fs.writeFileSync(path.join(directory, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }));
  fs.writeFileSync(path.join(directory, 'app.js'), '');
  fs.writeFileSync(path.join(directory, 'release-metadata.json'), JSON.stringify(config));
  assert.equal(checkArtifact(config, directory), directory);
  fs.writeFileSync(path.join(directory, 'project.config.json'), JSON.stringify({ appid: config.appid }));
  assert.throws(() => checkArtifact(config, directory), /不一致/);
});
