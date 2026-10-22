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
.app-page .wd-cell-group{border:1px solid rgba(255,255,255,.85);box-shadow:0 2px 12px rgba(38,43,72,.02);border-radius:${component.card.radius};overflow:hidden}
.app-page .wd-cell-group__body{border-radius:inherit}
.app-page .profile-panel .wd-cell-group{border:0}
.profile-cell .wd-cell__right{flex:0 0 20px}
.wd-button{min-height:${semantic.layout.hitMin};height:auto;white-space:normal;transition:transform ${primitive.motion.press}ms ease}
.wd-button:active:not(.is-disabled):not(.is-loading),.tap-feedback:active{transform:scale(0.98)}
.wd-button:focus-visible{outline:2px solid ${c.brand};outline-offset:3px}
.app-page .wd-search__block{border:1px solid rgba(255,255,255,.95);min-height:46px;box-sizing:border-box;box-shadow:0 2px 12px rgba(38,43,72,.035)}
.app-field .wd-input,.app-field .wd-textarea{border:0;box-sizing:border-box;background:transparent}
.app-field .wd-textarea{min-height:96px}
.app-field .wd-input::after,.app-field .wd-textarea::after{display:none}
.app-field .wd-cell{min-height:52px}
.app-field-error .wd-input,.app-field-error .wd-textarea{color:${c.danger}}
.sheet-content{${appThemeStyle};max-width:${semantic.layout.contentMax};margin:0 auto;max-height:85vh;overflow-y:auto;box-sizing:border-box;padding:24px 16px 16px;color:${c.ink};background:${c.surface}}
/* Wot 2.3.2 scopes picker popup geometry under the original picker ancestor.
   RootPortal relocates the node; use the same public theme variables here.
   Remove when upstream popup styling no longer relies on that ancestor. */
.wd-root-portal .wd-picker__popup{border-radius:var(--wot-picker-radius) var(--wot-picker-radius) 0 0;overflow:hidden}
.wd-root-portal .wd-datetime-picker__popup{border-radius:var(--wot-datetime-picker-popup-radius);overflow:hidden}
.lobby-hero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 2px 24px;min-height:92px;box-sizing:border-box}
.hero-mascot{width:60px;height:60px;border-radius:20px;box-shadow:0 8px 24px rgba(98,85,231,.13)}
.room-card.wd-card{border:1px solid rgba(255,255,255,.9);--wot-card-title-padding:12px 12px 8px;--wot-card-content-padding:0 12px 12px}
.next-team-card.wd-card{border:1px solid rgba(255,255,255,.9);--wot-card-content-padding:12px;--wot-card-bg:rgba(250,251,255,.96);box-shadow:0 2px 12px rgba(38,43,72,.04)}
.room-status-compact{display:inline-block;padding:2px 6px;font-size:11px;line-height:16px}
.room-reactions{display:grid;grid-template-columns:repeat(3,minmax(0,.7fr)) minmax(0,1.8fr) minmax(0,.75fr) minmax(0,1.05fr);gap:2px;border-top:1px solid ${c.border};padding-top:8px}
.room-reactions .room-reaction.wd-button{width:100%;min-width:0;min-height:44px;padding:0;font-size:12px;line-height:18px;white-space:nowrap;border-radius:10px;--wot-button-primary-color:${c.muted};--wot-button-primary-color-active:${c.muted};background:transparent}
.room-reactions .room-reaction-active.wd-button{--wot-button-primary-color:${c.brand};--wot-button-primary-color-active:${c['brand-pressed']}}
.reaction-symbol{display:inline-flex;align-items:center;vertical-align:middle;margin-right:3px}
.room-reactions .room-reaction .wd-button__content,.room-reactions .room-reaction .wd-button__text{min-width:0;white-space:nowrap}
.reaction-pulse{animation:reaction-pop 250ms ease-out}
.reaction-pulse-dislike{animation:reaction-press 300ms ease-out}
.reaction-cancel{animation:reaction-cancel 180ms ease-out}
@keyframes reaction-press{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(4px) scale(.88)}75%{transform:translateY(-1px) scale(1.03)}}
@keyframes reaction-cancel{0%,100%{transform:scale(1)}50%{transform:scale(.85)}}
.room-enter{animation:app-enter 180ms ease-out backwards}
@keyframes reaction-pop{0%,100%{transform:scale(1)}45%{transform:scale(1.18)}}
@media(max-width:360px){.room-card.wd-card{--wot-card-title-padding:12px 11px 8px;--wot-card-content-padding:0 11px 12px}.room-reactions{gap:0}.reaction-symbol{margin-right:1px}}
.room-inactive.wd-card{--wot-card-bg:${c.page}}
.room-progress .wd-progress__bar{border-radius:99px}

/* Content is quiet; translucent material is reserved for navigation and controls. */
.app-page{padding-bottom:calc(24px + env(safe-area-inset-bottom));background:radial-gradient(ellipse 360px 240px at 100% 0,rgba(210,220,251,.35),transparent 100%),radial-gradient(ellipse 300px 250px at 0 80px,rgba(228,219,249,.25),transparent 100%)}
.page-form{padding-bottom:calc(24px + env(safe-area-inset-bottom))}
.glass-surface{background:rgba(250,251,255,.96);border:1px solid ${component.glass.edge};box-shadow:${component.glass.shadow};box-sizing:border-box}
@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.glass-surface{background:${component.glass.surface};-webkit-backdrop-filter:blur(${component.glass.blur}) saturate(160%);backdrop-filter:blur(${component.glass.blur}) saturate(160%)}}
.glass-segment .wd-segmented__slider{box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 2px 6px rgba(38,43,72,.06)}
/* Bottom actions stay in the page flow instead of floating over the content. */
.app-dock{margin-top:12px;padding:8px;border-radius:24px}
.app-dock .wd-button{border-radius:18px;min-height:46px}
.glass-segment{border-radius:16px;border:1px solid rgba(255,255,255,.6);box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.game-quick-row{display:flex;white-space:nowrap}
.game-quick-row .game-quick-tab.wd-button{padding:0 9px;min-width:44px;height:44px;white-space:nowrap;color:${c.muted};border-radius:0}
.game-quick-label{display:inline-block;line-height:26px;padding:6px 0;border-bottom:2px solid transparent;transition:border-color 140ms ease,color 140ms ease}
.game-quick-active{border-bottom-color:${c.brand};color:${c.ink};font-weight:600}
@media(prefers-reduced-motion:reduce){.game-quick-label{transition:none!important}}
.filter-toolbar{display:flex;align-items:center;gap:6px;padding:6px 0 2px}
.filter-sort{flex:1;min-width:0;--wot-segmented-item-padding:6px 3px;--wot-segmented-item-font-size:12px}
.filter-toolbar .toolbar-search.wd-button{position:relative;padding:0;min-width:36px;flex-shrink:0;--wot-button-primary-color:${c.secondary}}
.search-indicator{position:absolute;top:9px;right:5px;width:5px;height:5px;border-radius:50%;background:${c.brand}}
.app-page .lobby-search{--wot-search-padding:4px 0;--wot-search-input-height:36px;--wot-search-input-font-size:13px}
.app-page .lobby-search .wd-search__block{min-height:36px;box-shadow:none}
.filter-sheet{padding:22px 16px calc(24px + env(safe-area-inset-bottom));max-height:82vh;overflow-y:auto;box-sizing:border-box;background:#F7F8FB}
.sheet-heading{font-size:20px;font-weight:600;letter-spacing:-.3px}
.content-heading{font-size:22px;line-height:30px;font-weight:650;letter-spacing:-.6px}
.section-label{font-size:12px;font-weight:500;letter-spacing:.4px;color:${c.muted};margin:24px 4px 10px}
.form-section{margin-bottom:14px;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.88);border:1px solid rgba(255,255,255,.95)}
.form-section .wd-cell-group{border:0;box-shadow:none}
.form-segments{padding:12px 14px}
.form-note{font-size:12px;line-height:18px;color:${c.muted};padding:0 4px;margin:8px 0 16px}
.empty-state{text-align:center;padding:38px 12px 28px}
.profile-panel{background:rgba(255,255,255,.8);border-color:rgba(255,255,255,.95)}
@media(prefers-reduced-transparency:reduce){.glass-surface{background:#FAFBFF;-webkit-backdrop-filter:none;backdrop-filter:none}}
@keyframes app-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.motion-enter,.motion-card,.room-enter,.reaction-pulse,.reaction-cancel,.wd-skeleton--animation-gradient::after,.wd-skeleton--animation-flashed{animation:none!important}.tap-feedback,.wd-button{transition:none!important}.tap-feedback:active,.wd-button:active{transform:none!important}}
`;
}
