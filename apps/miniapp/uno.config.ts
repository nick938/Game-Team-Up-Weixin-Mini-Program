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
      electric: '#7659ff',
      night: '#17182d',
      lime: '#b8f36b',
    },
  },
  shortcuts: {
    'app-page':
      'box-border mx-auto max-w-[960rpx] min-h-screen px-4 pt-6 pb-[calc(40rpx+env(safe-area-inset-bottom))] text-ink',
    panel: 'box-border bg-white rounded-3xl p-5 mb-4 border border-solid border-[#e9e8f2] surface-shadow',
    'hero-panel':
      'panel relative overflow-hidden bg-gradient-to-br from-[#eeebff] via-[#faf9ff] to-[#f0faf7] !border-[#e0dbfa]',
    'page-heading': 'text-[44rpx] font-bold leading-snug tracking-tight break-words',
    'page-caption': 'text-sm text-muted leading-6 mt-2',
    'section-title': 'text-base font-semibold leading-6',
    hint: 'text-xs text-muted leading-5',
    avatar: 'w-14 h-14 rounded-2xl shrink-0',
    'sheet-content': 'box-border p-5 pt-7 pb-[calc(24rpx+env(safe-area-inset-bottom))]',
    'flex-center': 'flex items-center justify-center',
    'brand-kicker': 'text-[22rpx] font-semibold tracking-[3rpx] text-brand',
    'count-badge': 'inline-flex items-center rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand',
    'room-status': 'shrink-0 rounded-full px-2.5 py-1 text-[22rpx] font-semibold leading-4',
    'room-meta': 'text-[24rpx] text-[#73768b] leading-5',
    'room-tag': 'rounded-md bg-[#f3f3f8] px-2 py-0.5 text-[22rpx] text-[#62657b] leading-5',
    'game-symbol': 'flex-center w-11 h-11 rounded-2xl mb-2 text-sm font-bold',
  },
  safelist: ['motion-step-1', 'motion-step-2', 'motion-step-3', 'motion-step-4', 'motion-step-5'],
  rules: [
    ['surface-shadow', { 'box-shadow': '0 8px 28px -16px rgba(46,35,103,0.2)' }],
    ['motion-enter', { animation: 'app-enter 420ms cubic-bezier(0.2,0.7,0.2,1) both' }],
    ['motion-delay', { 'animation-delay': '70ms' }],
    ['motion-float', { animation: 'app-float 4.5s ease-in-out 2' }],
    ['tap-feedback', { transition: 'transform 160ms ease,box-shadow 160ms ease' }],
    ['profile-surface', { '--wot-cell-group-bg': 'transparent' }],
    ['motion-card', { animation: 'app-enter 300ms cubic-bezier(0.2,0.7,0.2,1) both' }],
    [/^motion-step-([1-5])$/, ([, step]) => ({ 'animation-delay': `${Number(step) * 35}ms` })],
    ['game-amber', { background: 'linear-gradient(145deg,#fff1cd,#ffdba5)', color: '#865715' }],
    ['game-mint', { background: 'linear-gradient(145deg,#dcf6ea,#bce8d6)', color: '#286d59' }],
    ['game-rose', { background: 'linear-gradient(145deg,#ffe5ed,#ffcbd8)', color: '#a84163' }],
    ['game-violet', { background: 'linear-gradient(145deg,#eee8ff,#dcd1ff)', color: '#6548b9' }],
  ],
  preflights: [
    {
      getCSS: () => `
    page,body{background:#f5f6fa;color:#202438;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
    .app-page{background-image:radial-gradient(ellipse 100% 240px at 15% 0,rgba(98,85,231,0.065),transparent)}
    page,body,.wot-theme-light{
      --wot-primary-1:#eeecff!important;--wot-primary-2:#ded9ff!important;
      --wot-primary-6:#6255e7!important;--wot-primary-7:#5549c7!important;
      --wot-card-radius:24px;--wot-card-shadow:0 8px 28px -16px rgba(46,35,103,0.2);
      --wot-card-title-padding:18px 20px 8px;--wot-card-title-font-weight:700;
      --wot-card-content-padding:8px 20px 20px;--wot-card-title-color:#202438;
      --wot-popup-radius:28px;--wot-search-bg:transparent;--wot-search-padding:0;
      --wot-search-plain-bg:transparent;--wot-search-block-margin-right:0;
      --wot-search-block-bg:#fff;--wot-search-cover-bg:#fff;
      --wot-cell-title-color:#202438;--wot-cell-value-color:#777e92
    }
    .app-page .wd-cell-group{border-radius:20px;box-shadow:0 6px 24px -18px rgba(46,35,103,0.2)}
    .app-page .wd-cell-group__body{border-radius:inherit;overflow:hidden}
    .profile-cell .wd-cell__right{flex:0 0 20px}
    .lobby-page{padding-top:12px;background:#f6f7fb;
      --wot-primary-6:#7659ff!important;--wot-primary-7:#6245e8!important;
      --wot-search-input-font-size:13px;--wot-search-placeholder-font-size:13px;
      --wot-search-placeholder-color:#85879b;--wot-search-icon-color:#7659ff}
    .lobby-hero{position:relative;overflow:hidden;border-radius:24px;padding:20px 22px;margin-bottom:16px;
      background:radial-gradient(ellipse at 88% 18%,#494077 0,transparent 57%),linear-gradient(125deg,#17182d,#27233e);
      box-shadow:0 12px 26px -16px rgba(23,24,45,0.5)}
    .hero-orbit{position:absolute;right:9px;top:20px;width:124px;height:124px;border:1px solid rgba(201,190,255,0.22);border-radius:50%;transform:rotate(-25deg) scaleY(0.58)}
    .hero-orbit:after{content:'';position:absolute;width:7px;height:7px;border-radius:50%;right:16px;top:6px;background:#b8f36b;box-shadow:0 0 12px rgba(184,243,107,0.4)}
    .hero-mascot{position:absolute;right:23px;top:28px;width:94px;height:94px;border-radius:30px;transform:rotate(9deg);box-shadow:0 12px 28px rgba(0,0,0,0.22);animation:hero-arrive 600ms ease both}
    .lobby-page .game-entry.wd-button{width:100%;height:auto!important;min-width:0;padding:12px 2px!important;line-height:normal!important;border-radius:18px!important;background:#fff!important;border:1px solid #ededf5!important;box-shadow:0 3px 12px -10px rgba(23,24,45,0.25);color:#35364d}
    .lobby-page .game-entry .wd-button__content{height:auto!important;line-height:normal!important}
    .lobby-page .wd-search__block{box-shadow:0 4px 18px -12px rgba(23,24,45,0.2);border-color:#eaeaf2}
    .sort-segment{padding:3px;border-radius:999px;background:#eaeaf2}
    .sort-segment .wd-button{min-width:48px;padding:0 12px;height:28px;font-size:12px;border:0}
    .sort-segment .sort-active{background:#fff!important;color:#26263b!important;box-shadow:0 2px 6px rgba(23,24,45,0.08)}
    .room-card.wd-card{border:1px solid #e8e8f1;--wot-card-shadow:0 6px 20px -16px rgba(23,24,45,0.25);--wot-card-radius:20px;
      --wot-card-title-padding:16px 16px 8px;--wot-card-content-padding:0 16px 16px;--wot-primary-6:#7659ff;--wot-primary-7:#6245e8}
    .room-inactive.wd-card{--wot-card-bg:#fafafd}
    .room-progress .wd-progress__bar{border-radius:99px}
    .skeleton-shape{background:#eaeaf2;border-radius:8px;animation:skeleton-breathe 1.4s ease-in-out infinite}
    @keyframes hero-arrive{from{opacity:0;transform:translateY(8px) rotate(1deg)}to{opacity:1;transform:rotate(9deg)}}
    @keyframes skeleton-breathe{0%,100%{opacity:0.55}50%{opacity:1}}
    .app-page .wd-search__block{border-radius:16px;border:1px solid #e9e8f2;min-height:44px;box-sizing:border-box}
    .wd-button{transition:transform 160ms ease,box-shadow 160ms ease}
    .wd-button:active:not(.is-disabled):not(.is-loading),.tap-feedback:active{transform:scale(0.98)}
    .wd-button:focus-visible{outline:2px solid #6255e7;outline-offset:3px}
    .team-surface{border:1px solid #e9e8f2}
    .team-surface:active{box-shadow:0 3px 12px -6px rgba(46,35,103,0.2)}
    @keyframes app-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @keyframes app-float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-5px) rotate(2deg)}}
    @media (prefers-reduced-motion:reduce){
      .motion-enter,.motion-float,.motion-card,.hero-mascot,.skeleton-shape{animation:none!important}
      .tap-feedback,.wd-button{transition:none!important}
      .tap-feedback:active,.wd-button:active{transform:none!important}
    }
  `,
    },
  ],
});
