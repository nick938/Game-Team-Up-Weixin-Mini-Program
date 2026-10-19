import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';
import { presetUni } from '@uni-helper/unocss-preset-uni';
import { presetLegacyCompat } from '@unocss/preset-legacy-compat';
import { primitive, semantic } from './src/design/tokens.ts';
import { spacing, fontSize, baseStyles } from './src/design/uno-theme.ts';

export default defineConfig({
  presets: [
    presetUni({ attributify: false }),
    presetLegacyCompat({ commaStyleColorFunction: true, legacyColorSpace: true }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: { ...semantic.color, white: semantic.color.surface, electric: semantic.color.brand },
    spacing,
    fontSize,
    borderRadius: { md: '6px', lg: '12px', xl: '12px', '2xl': '16px', '3xl': '16px' },
  },
  shortcuts: {
    'app-page': 'text-ink',
    panel: 'box-border bg-surface rounded-2xl p-4 mb-3 border border-solid border-border',
    'hero-panel': 'panel relative overflow-hidden',
    'page-heading': 'text-[22px] font-semibold leading-[30px] break-words',
    'page-caption': 'text-sm text-secondary leading-[22px] mt-2',
    'section-title': 'text-lg font-semibold leading-[26px]',
    hint: 'text-xs text-muted leading-[18px]',
    avatar: 'w-12 h-12 rounded-xl shrink-0',
    'flex-center': 'flex items-center justify-center',
    'brand-kicker': 'text-xs font-semibold text-brand',
    'count-badge': 'inline-flex items-center rounded-full bg-brand-light px-2 py-1 text-xs text-brand',
    'room-status': 'shrink-0 rounded-md px-2 py-1 text-xs font-semibold leading-[18px]',
    'room-meta': 'text-sm text-secondary leading-[22px]',
    'room-tag': 'rounded-md bg-surface-muted px-2 py-1 text-xs text-secondary leading-[18px]',
    'game-symbol': 'flex-center w-9 h-9 rounded-xl mb-1 text-sm font-semibold',
    'tap-feedback': 'transition-transform',
    'field-error': 'mt-2 text-sm text-danger leading-[22px]',
  },
  rules: [
    ['surface-shadow', { 'box-shadow': 'none' }],
    ['motion-enter', { animation: `app-enter ${primitive.motion.transition}ms ease both` }],
    ['motion-card', { animation: `app-enter ${primitive.motion.transition}ms ease both` }],
    ['game-amber', { background: semantic.illustration.amber, color: semantic.color.warning }],
    ['game-mint', { background: semantic.illustration.mint, color: semantic.color.success }],
    ['game-rose', { background: semantic.illustration.rose, color: semantic.color.danger }],
    ['game-violet', { background: semantic.illustration.violet, color: semantic.color.brand }],
  ],
  preflights: [{ getCSS: baseStyles }],
});
