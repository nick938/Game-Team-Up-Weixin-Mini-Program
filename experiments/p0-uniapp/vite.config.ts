import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  define: {
    __P0_BUILD_TARGET__: JSON.stringify(process.env.UNI_PLATFORM || 'unknown'),
  },
});
