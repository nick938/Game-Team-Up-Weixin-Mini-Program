import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { CHANGELOG } from '../../apps/miniapp/src/utils/changelog.ts';
import { appRoot, releaseVersion, main as release } from './release.mjs';

const packageVersion = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version;

export function wechatReleaseVersion(env, manifestVersion = packageVersion, notesVersion = CHANGELOG[0]?.version) {
  let input = env.MINIAPP_VERSION || manifestVersion;
  if (env.GITHUB_EVENT_NAME === 'push') {
    if (!/^refs\/tags\/v\d+\.\d+\.\d+$/.test(env.GITHUB_REF || '')) {
      throw new Error('自动上传仅接受推送的 vX.Y.Z Tag');
    }
    input = env.GITHUB_REF.slice('refs/tags/'.length);
  } else if (env.GITHUB_EVENT_NAME && env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('仅支持 Tag 推送或手动上传');
  }
  const version = releaseVersion(input);
  if (version !== manifestVersion || version !== notesVersion) {
    throw new Error('Tag/上传版本、apps/miniapp/package.json 与最新更新日志版本必须一致，请先同步代码与发布说明');
  }
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await release('plan', { ...process.env, MINIAPP_TARGETS: 'weixin', MINIAPP_VERSION: wechatReleaseVersion(process.env) });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
