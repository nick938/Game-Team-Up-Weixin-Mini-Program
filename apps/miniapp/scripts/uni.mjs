import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile, loadEnv } from 'vite';

// uni initializes its environment before loading Vite plugins. Generate the real
// manifest first so a fresh checkout works without an ignored local JSON file.
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const build = args[0] === 'build';
const modeIndex = args.findIndex((arg) => arg === '--mode' || arg === '-m');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : build ? 'production' : 'development';
const env = loadEnv(mode, root, 'VITE_');
process.env.VITE_WEIXIN_APP_ID = env.VITE_WEIXIN_APP_ID || '';
process.env.VITE_QQ_APP_ID = env.VITE_QQ_APP_ID || '';
const loaded = await loadConfigFromFile(
  { command: build ? 'build' : 'serve', mode },
  fileURLToPath(new URL('../manifest.config.ts', import.meta.url)),
  root,
);
if (!loaded) throw new Error('Unable to load manifest.config.ts');
writeFileSync(new URL('../src/manifest.json', import.meta.url), JSON.stringify(loaded.config, null, 2));

await import('@dcloudio/vite-plugin-uni/bin/uni.js');
