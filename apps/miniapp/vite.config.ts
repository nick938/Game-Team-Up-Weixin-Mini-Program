// Selected unibest base plugins; CI upload is managed separately under scripts/miniapp.
import { defineConfig, loadEnv } from 'vite';
import uni from '@uni-helper/plugin-uni';
import UniManifest from '@uni-helper/vite-plugin-uni-manifest';
import UniPages from '@uni-helper/vite-plugin-uni-pages';
import UnoCSS from 'unocss/vite';
import pkg from './package.json';

export default defineConfig(({ mode }) => {
  // Forward only public application IDs; upload credentials never use the VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  process.env.VITE_QQ_APP_ID = env.VITE_QQ_APP_ID || '';
  process.env.VITE_WEIXIN_APP_ID = env.VITE_WEIXIN_APP_ID || '';
  const version = process.env.MINIAPP_VERSION || pkg.version;
  if (!/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version)) throw new Error('Invalid MINIAPP_VERSION');
  return {
    plugins: [ UniManifest(), UniPages({ mergePages: false, homePage: 'pages/index/index', dts: 'src/types/uni-pages.d.ts' }), uni(), UnoCSS()],
    define: { __BUILD_TARGET__: JSON.stringify(process.env.UNI_PLATFORM || 'unknown'), __APP_VERSION__: JSON.stringify(version) },
    server: { host: '127.0.0.1' },
  };
});
