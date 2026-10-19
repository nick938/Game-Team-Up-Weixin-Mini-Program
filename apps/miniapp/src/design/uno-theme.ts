import { component, primitive, semantic, appThemeStyle } from './tokens.ts';
import { wotThemeVars } from './wot-theme.ts';

// The uni preset normally scales spacing with the window. Stable controls use px.
export const spacing = Object.fromEntries(
  Array.from({ length: 385 }, (_, i) => [String(i / 2), `${i * 2}px`]),
);
export const fontSize = {
  xs: [semantic.typography.caption, semantic.lineHeight.caption],
  sm: [semantic.typography.secondary, semantic.lineHeight.secondary],
  base: [semantic.typography.body, semantic.lineHeight.body],
  lg: [semantic.typography.section, semantic.lineHeight.section],
  xl: [semantic.typography.title, semantic.lineHeight.title],
  '2xl': [semantic.typography.hero, semantic.lineHeight.heading],
  '3xl': [semantic.typography.display, semantic.lineHeight.display],
};
const wotStyle = Object.entries(wotThemeVars)
  .map(([key, value]) => {
    const cssKey = key
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([a-zA-Z])(\d)/g, '$1-$2')
      .toLowerCase();
    return `--wot-${cssKey}:${value}`;
  })
  .join(';');
export function baseStyles() {
  const c = semantic.color;
  return `
page,body{${appThemeStyle};${wotStyle};background:${c.page};color:${c.ink};font-family:${semantic.fontFamily};font-size:${semantic.typography.body};line-height:1.5}
.wot-theme-light{${appThemeStyle}}
.app-page{width:100%;max-width:${semantic.layout.contentMax};padding:16px ${semantic.layout.gutter} calc(24px + env(safe-area-inset-bottom));margin:0 auto;box-sizing:border-box;min-height:100vh}
@media(max-width:359px){.app-page{padding-left:${semantic.layout.narrowGutter};padding-right:${semantic.layout.narrowGutter}}}
.app-page .wd-cell-group{border:1px solid ${c.border};border-radius:${component.card.radius};overflow:hidden}
.app-page .wd-cell-group__body{border-radius:inherit}
.app-page .profile-panel .wd-cell-group{border:0}
.profile-cell .wd-cell__right{flex:0 0 20px}
.wd-button{min-height:${semantic.layout.hitMin};height:auto;white-space:normal;transition:transform ${primitive.motion.press}ms ease}
.wd-button:active:not(.is-disabled):not(.is-loading),.tap-feedback:active{transform:scale(0.98)}
.wd-button:focus-visible{outline:2px solid ${c.brand};outline-offset:3px}
.app-page .wd-search__block{border-radius:${component.button.radius};border:1px solid ${c['control-border']};min-height:48px;box-sizing:border-box}
.app-field .wd-input,.app-field .wd-textarea{border:1px solid ${c['control-border']};border-radius:${component.button.radius};box-sizing:border-box}
.app-field .wd-textarea{min-height:96px}
.app-field .wd-input::after,.app-field .wd-textarea::after{display:none}
.app-field .wd-cell{min-height:52px}
.app-field-error .wd-input,.app-field-error .wd-textarea{border-color:${c.danger}}
.sheet-content{${appThemeStyle};max-width:${semantic.layout.contentMax};margin:0 auto;max-height:85vh;overflow-y:auto;box-sizing:border-box;padding:24px 16px 16px;color:${c.ink};background:${c.surface}}
/* Wot 2.3.2 scopes picker popup geometry under the original picker ancestor.
   RootPortal relocates the node; use the same public theme variables here.
   Remove when upstream popup styling no longer relies on that ancestor. */
.wd-root-portal .wd-picker__popup{border-radius:var(--wot-picker-radius) var(--wot-picker-radius) 0 0;overflow:hidden}
.wd-root-portal .wd-datetime-picker__popup{border-radius:var(--wot-datetime-picker-popup-radius);overflow:hidden}
.lobby-hero{position:relative;overflow:hidden;border-radius:${component.hero.radius};min-height:${component.hero.height};padding:16px 20px;margin-bottom:16px;box-sizing:border-box;background:${c.night};color:${c['on-brand']}}
.hero-mascot{position:absolute;right:18px;top:24px;width:84px;height:84px;border-radius:24px;transform:rotate(8deg)}
.hero-orbit{position:absolute;right:8px;top:18px;width:112px;height:100px;border:1px solid rgba(255,255,255,.2);border-radius:50%;transform:rotate(-25deg) scaleY(.7)}
.app-page .game-entry.wd-button.is-text{width:100%;min-width:0;min-height:76px;padding:8px 2px!important;border-radius:12px;border:1px solid ${c.border};background:${c.surface};color:${c.ink};--wot-button-primary-color:${c.ink}}
.game-entry .wd-button__content{height:auto;line-height:normal}
.sort-segment{display:flex;gap:4px;padding:3px;border-radius:12px;background:${c['surface-muted']}}
.sort-segment .wd-button{min-width:48px;padding:0 10px;border:0}
.sort-segment .sort-active{background:${c.surface}!important;color:${c.brand}!important}
.room-card.wd-card{border:1px solid ${c.border};--wot-card-title-padding:16px 16px 8px;--wot-card-content-padding:0 16px 16px}
.room-inactive.wd-card{--wot-card-bg:${c.page}}
.room-progress .wd-progress__bar{border-radius:99px}
.skeleton-shape{background:${c['surface-muted']};border-radius:8px;animation:skeleton-breathe 1.4s ease-in-out infinite}
@keyframes skeleton-breathe{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes app-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.motion-enter,.motion-card,.skeleton-shape{animation:none!important}.tap-feedback,.wd-button{transition:none!important}.tap-feedback:active,.wd-button:active{transform:none!important}}
`;
}
