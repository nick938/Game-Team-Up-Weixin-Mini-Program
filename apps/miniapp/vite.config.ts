// Selected unibest base plugins; demo pages, upload automation and unrelated hosts are omitted.
import { defineConfig, loadEnv } from 'vite';
import uni from '@uni-helper/plugin-uni';
import UniManifest from '@uni-helper/vite-plugin-uni-manifest';
import UniPages from '@uni-helper/vite-plugin-uni-pages';
import UnoCSS from 'unocss/vite';

export default defineConfig(({ mode }) => {
  // Manifest config is evaluated by the generator; forward only the public QQ application ID.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  process.env.VITE_QQ_APP_ID = env.VITE_QQ_APP_ID || '';
  return {
    plugins: [ UniManifest(), UniPages({ mergePages: false, homePage: 'pages/index/index', dts: 'src/types/uni-pages.d.ts' }), uni(), UnoCSS()],
    define: { __BUILD_TARGET__: JSON.stringify(process.env.UNI_PLATFORM || 'unknown') },
    server: { host: '127.0.0.1' },
  };
});
