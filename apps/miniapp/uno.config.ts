import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';
import { presetUni } from '@uni-helper/unocss-preset-uni';
import { presetLegacyCompat } from '@unocss/preset-legacy-compat';

export default defineConfig({
  presets: [
    presetUni({ attributify: false }),
    presetLegacyCompat({ commaStyleColorFunction: true, legacyColorSpace: true }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      brand: '#6255e7',
      'brand-light': '#eeecff',
      muted: '#777e92',
      ink: '#202438',
      danger: '#c54d69',
    },
  },
  shortcuts: {
    'app-page':
      'box-border mx-auto max-w-[960rpx] min-h-screen px-4 pt-6 pb-[calc(40rpx+env(safe-area-inset-bottom))] text-ink',
    panel: 'box-border bg-white rounded-3xl p-5 mb-4',
    'page-heading': 'text-[44rpx] font-bold leading-snug break-words',
    'page-caption': 'text-sm text-muted leading-6 mt-2',
    'section-title': 'text-base font-semibold leading-6',
    hint: 'text-xs text-muted leading-5',
    avatar: 'w-14 h-14 rounded-2xl shrink-0',
    'sheet-content': 'box-border p-5 pt-7 pb-[calc(24rpx+env(safe-area-inset-bottom))]',
    'flex-center': 'flex items-center justify-center',
  },
  preflights: [
    {
      getCSS: () => `
    page,body{background:#f5f6fa;color:#202438;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;
      }
    page,body,.wot-theme-light{--wot-primary-1:#eeecff!important;--wot-primary-2:#ded9ff!important;--wot-primary-6:#6255e7!important;--wot-primary-7:#5549c7!important}
  `,
    },
  ],
});
