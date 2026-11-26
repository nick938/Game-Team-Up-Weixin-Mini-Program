import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!['mp-weixin', 'mp-qq'].includes(target)) throw new Error('Expected mp-weixin or mp-qq');
const pages = [
  'index/index',
  'game/game',
  'mine/mine',
  'team/detail',
  'publish/publish',
  'publish/claim',
  ...(target === 'mp-qq' ? ['play/play'] : []),
  'friday/friday',
];
const appPath = fileURLToPath(new URL(`../dist/build/${target}/app.json`, import.meta.url));
const app = JSON.parse(readFileSync(appPath, 'utf8'));
const registeredPages = [
  ...app.pages,
  ...(app.subPackages || []).flatMap(({ root, pages }) => pages.map((page) => `${root}/${page}`)),
];
if (target === 'mp-weixin' && registeredPages.includes('pages/play/play'))
  throw new Error('The retired vote page must not be registered in the WeChat build');
// uni's native page runtime enables onShareAppMessage=2 and onShareTimeline=4.
// Executing composables in tests does not prove those native methods are emitted.
const failures = pages.filter((page) => {
  if (!registeredPages.includes(`pages/${page}`)) return true;
  const path = fileURLToPath(new URL(`../dist/build/${target}/pages/${page}.js`, import.meta.url));
  const code = readFileSync(path, 'utf8');
  const flags = Number(code.match(/\.__runtimeHooks\s*=\s*(\d+)/)?.[1] || 0);
  return (flags & 6) !== 6;
});
if (failures.length) throw new Error(`Native sharing hooks missing: ${failures.join(', ')}`);
console.log(`${target}: native share hooks verified for ${pages.length} pages`);
