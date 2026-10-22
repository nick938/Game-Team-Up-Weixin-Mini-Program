import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const appRoot = path.join(root, 'apps/miniapp');
const targets = { weixin: 'mp-weixin', qq: 'mp-qq' };
const readJSON = file => JSON.parse(readFileSync(file, 'utf8'));

export function releaseVersion(input = '') {
  const version = (input || readJSON(path.join(appRoot, 'package.json')).version).trim().replace(/^v/, '');
  if (!/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version)) {
    throw new Error('版本号必须为 x.y.z，每段 0–999，例如 1.8.5');
  }
  return version;
}

export function selectApps(selector = 'all', apps = readJSON(path.join(root, 'scripts/miniapp/apps.json'))) {
  const ids = new Set();
  for (const app of apps) {
    if (!/^[a-z][a-z0-9-]*$/.test(app.id) || ids.has(app.id) || !Object.hasOwn(targets, app.platform)
        || !/^miniapp-[a-z0-9-]+$/.test(app.environment) || typeof app.appid !== 'string') {
      throw new Error('应用清单包含重复 ID、无效环境名或不支持的平台');
    }
    ids.add(app.id);
  }
  const selectors = selector.split(',').map(value => value.trim()).filter(Boolean);
  if (!selectors.length || selectors.some(value => value !== 'all' && !ids.has(value) && !Object.hasOwn(targets, value))) {
    throw new Error('未知发布目标，请使用 all、weixin、qq 或应用 ID（逗号分隔）');
  }
  const selected = apps.filter(app => selectors.includes('all') || selectors.includes(app.id) || selectors.includes(app.platform));
  if (!selected.length) throw new Error('没有匹配的发布应用');
  return selected;
}

export function releaseConfig(app, env = process.env) {
  const appid = (env.MINIAPP_APP_ID || app.appid).trim();
  const validID = app.platform === 'weixin' ? /^wx[a-zA-Z0-9]{16}$/.test(appid) : /^\d{5,20}$/.test(appid);
  if (!validID) throw new Error(`${app.id}: 请在 ${app.environment} 配置有效 APP_ID`);
  const apiBaseURL = env.MINIAPP_API_BASE_URL || '';
  if (app.platform === 'qq') {
    let url;
    try { url = new URL(apiBaseURL); } catch { /* Validated below. */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /\/p0\/health\/?$/.test(url.pathname)) {
      throw new Error(`${app.id}: 请配置已部署的 HTTPS 业务 API_BASE_URL，不能使用健康探测地址`);
    }
  }
  return {
    ...app, appid, apiBaseURL, target: targets[app.platform],
    version: releaseVersion(env.MINIAPP_VERSION),
    description: (env.MINIAPP_DESCRIPTION || '开黑星球版本更新').trim(),
  };
}

export function checkArtifact(config, directory = path.join(appRoot, 'dist/build', config.target)) {
  const project = readJSON(path.join(directory, 'project.config.json'));
  const app = readJSON(path.join(directory, 'app.json'));
  const metadata = readJSON(path.join(directory, 'release-metadata.json'));
  const artifactAppID = config.platform === 'qq' ? project.qqappid : project.appid;
  if (String(artifactAppID) !== config.appid || metadata.appid !== config.appid
      || metadata.version !== config.version || metadata.platform !== config.platform || metadata.id !== config.id) {
    throw new Error('构建产物的应用、AppID 或版本与上传目标不一致，请重新构建');
  }
  if (!app.pages?.includes('pages/index/index') || !existsSync(path.join(directory, 'app.js'))) {
    throw new Error('构建产物缺少应用入口');
  }
  return directory;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} 执行失败${result.status === null ? '' : `，退出码 ${result.status}`}`);
  return result;
}

export function build(config, execute = run) {
  execute('pnpm', ['run', `build:${config.platform}`], {
    cwd: appRoot,
    env: {
      ...process.env, CHOKIDAR_USEPOLLING: '1', MINIAPP_VERSION: config.version,
      VITE_WEIXIN_APP_ID: config.platform === 'weixin' ? config.appid : '',
      VITE_QQ_APP_ID: config.platform === 'qq' ? config.appid : '',
      VITE_API_BASE_URL: config.apiBaseURL,
    },
  });
  const directory = path.join(appRoot, 'dist/build', config.target);
  writeFileSync(path.join(directory, 'release-metadata.json'), JSON.stringify({
    id: config.id, platform: config.platform, appid: config.appid, version: config.version,
    commit: process.env.GITHUB_SHA || '',
  }, null, 2) + '\n');
  return checkArtifact(config);
}

export function checkCredentials(config, env = process.env) {
  const key = config.platform === 'weixin' ? 'WEIXIN_UPLOAD_PRIVATE_KEY' : 'QQ_APP_TOKEN';
  if (!env[key]?.trim()) throw new Error(`${config.id}: 缺少 Secret ${key}`);
  if (config.platform === 'qq' && env.QQ_EXPERIENCE && !['true', 'false'].includes(env.QQ_EXPERIENCE)) {
    throw new Error('QQ_EXPERIENCE 必须为 true 或 false');
  }
}

export async function uploadWechat(config, directory, env, sdk) {
  const project = new sdk.Project({
    appid: config.appid, type: 'miniProgram', projectPath: directory,
    privateKey: env.WEIXIN_UPLOAD_PRIVATE_KEY, ignores: ['release-metadata.json'],
  });
  await sdk.upload({
    project, version: config.version, desc: config.description,
    robot: 1, setting: { useProjectConfig: true, minify: true }, onProgressUpdate() {},
  });
}

export function qqInvocation(config, directory, env) {
  const image = env.QQ_CI_IMAGE || 'qqminiapp/build@sha256:e7a8149fce454f862740961684a0a90569bda715fc13c730cf0bb901bd9c1c14';
  if (!/^qqminiapp\/build(?::[a-zA-Z0-9._-]+|@sha256:[a-f0-9]{64})$/.test(image)) throw new Error('QQ_CI_IMAGE 必须指向官方 qqminiapp/build 镜像');
  const plugin = {
    PLUGIN_VERSION: config.version, PLUGIN_DESC: config.description,
    PLUGIN_APPTOKEN: env.QQ_APP_TOKEN, PLUGIN_BUILDUSER: 'CI',
    PLUGIN_EXPERIENCE: env.QQ_EXPERIENCE || 'false', PLUGIN_PREVIEW: 'false',
    PLUGIN_USEPACKAGEJSON: 'false', PLUGIN_NPMBUILD: 'false', PLUGIN_SOURCECODEPATH: '.',
  };
  return {
    args: ['run', '--rm', '--platform', 'linux/amd64', ...Object.keys(plugin).flatMap(key => ['-e', key]),
      '--mount', `type=bind,src=${directory},dst=/workspace`, '-w', '/workspace', image],
    env: { ...env, ...plugin },
  };
}

// SDK/container failures may contain credentials; never print raw SDK errors or result objects.
export async function upload(config, env = process.env, dependencies = {}) {
  checkCredentials(config, env);
  const directory = checkArtifact(config);
  if (config.platform === 'weixin') {
    const require = createRequire(path.join(root, 'tools/miniapp-release/package.json'));
    await uploadWechat(config, directory, env, dependencies.sdk || require('miniprogram-ci'));
  } else {
    const invocation = qqInvocation(config, directory, env);
    (dependencies.run || run)('docker', invocation.args, { env: invocation.env, stdio: 'pipe', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  }
}

function summary(config, status) {
  const report = {
    id: config.id, platform: config.platform, version: config.version, status,
    scope: 'developer upload only; not audit submission or production release',
  };
  const directory = path.join(appRoot, 'dist/release');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${config.id}.json`), JSON.stringify(report, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Upload receipt\n\n| App | Platform | Version | Result |\n| --- | --- | --- | --- |\n| ${config.id} | ${config.platform} | ${config.version} | ${status} |\n`);
  }
}

export async function main(command, env = process.env) {
  if (command === 'plan') {
    const matrix = { include: selectApps(env.MINIAPP_TARGETS || 'all') };
    const version = releaseVersion(env.MINIAPP_VERSION);
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\nversion=${version}\n`);
    console.log(JSON.stringify({ version, ...matrix }, null, 2));
    return;
  }
  const app = selectApps(env.MINIAPP_TARGETS).find(item => item.id === env.MINIAPP_TARGETS);
  if (!app) throw new Error('构建或上传时必须指定单个应用 ID');
  const config = releaseConfig(app, env);
  if (command === 'preflight') checkCredentials(config, env);
  else if (command === 'build') build(config);
  else if (command === 'upload') {
    try { await upload(config, env); summary(config, 'uploaded'); }
    catch { summary(config, 'failed'); throw new Error(`${config.id} 上传失败，请核对凭据、IP 白名单及平台后台；详细错误不输出以避免泄露凭据`); }
  } else throw new Error('命令必须为 plan、preflight、build 或 upload');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
