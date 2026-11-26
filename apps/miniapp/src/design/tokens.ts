/** Pure design source shared by Vite, native navigation and runtime components. */
export const primitive = {
  color: {
    violet: '#6255E7',
    violetPressed: '#5144CC',
    lavender: '#EEECFF',
    lavenderPressed: '#DED9FF',
    white: '#FFFFFF',
    page: '#F4F5F8',
    surfaceMuted: '#F0F1F6',
    border: '#E4E7EF',
    ink: '#22232A',
    secondary: '#596174',
    tertiary: '#7D818F',
    green: '#237A4B',
    greenSoft: '#EAF7EE',
    amber: '#8A5A00',
    amberSoft: '#FFF4D6',
    red: '#B83250',
    redSoft: '#FDEEF2',
    night: '#17182D',
    lime: '#B8F36B',
  },
  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' },
  radius: { tag: '6px', control: '12px', card: '16px', hero: '20px', sheet: '24px', pill: '999px' },
  font: {
    caption: '12px',
    secondary: '14px',
    body: '16px',
    section: '18px',
    title: '20px',
    heading: '22px',
    hero: '24px',
    display: '30px',
  },
  lineHeight: {
    caption: '18px',
    secondary: '22px',
    body: '24px',
    section: '26px',
    title: '28px',
    heading: '30px',
    hero: '32px',
    display: '36px',
  },
  fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif',
  motion: { press: 140, transition: 220 },
} as const;

export const semantic = {
  color: {
    brand: primitive.color.violet,
    'brand-pressed': primitive.color.violetPressed,
    'brand-light': primitive.color.lavender,
    'brand-soft-pressed': primitive.color.lavenderPressed,
    page: primitive.color.page,
    surface: primitive.color.white,
    'surface-muted': primitive.color.surfaceMuted,
    ink: primitive.color.ink,
    secondary: primitive.color.secondary,
    muted: primitive.color.tertiary,
    border: primitive.color.border,
    'control-border': primitive.color.border,
    success: primitive.color.green,
    'success-soft': primitive.color.greenSoft,
    warning: primitive.color.amber,
    'warning-soft': primitive.color.amberSoft,
    danger: primitive.color.red,
    'danger-soft': primitive.color.redSoft,
    night: primitive.color.night,
    lime: primitive.color.lime,
    'on-brand': primitive.color.white,
  },
  layout: {
    contentMax: '560px',
    gutter: primitive.space.lg,
    narrowGutter: primitive.space.md,
    hitMin: '44px',
  },
  typography: primitive.font,
  lineHeight: primitive.lineHeight,
  fontFamily: primitive.fontFamily,
  motion: primitive.motion,
  // Decoration only; not another set of UI status colors.
  illustration: {
    amber: primitive.color.amberSoft,
    mint: primitive.color.greenSoft,
    rose: primitive.color.redSoft,
    violet: primitive.color.lavender,
  },
} as const;

export const component = {
  button: { height: '48px', compactHeight: '44px', radius: primitive.radius.control },
  card: { radius: primitive.radius.card, padding: primitive.space.lg, gap: primitive.space.md },
  sheet: { radius: primitive.radius.sheet, duration: semantic.motion.transition },
  overlay: { pickerDuration: 300, frameBuffer: 16 },
  hero: { radius: primitive.radius.hero, height: '136px' },
  tabBar: { reserve: '76px' },
  avatar: { size: '48px', radius: primitive.radius.control },
  glass: {
    surface: 'rgba(255,255,255,.72)',
    edge: 'rgba(255,255,255,.92)',
    blur: '24px',
    shadow:
      '0 8px 32px rgba(38,43,72,.08),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.45)',
  },
  layer: { sheet: 1100, picker: 1200, dialog: 1400, toast: 1500 },
} as const;

export const appCSSVars = Object.fromEntries([
  ...Object.entries(semantic.color).map(([name, value]) => [`--app-${name}`, value]),
  ['--app-content-max', semantic.layout.contentMax],
  ['--app-card-radius', component.card.radius],
  ['--app-sheet-radius', component.sheet.radius],
  ['--app-tab-bar-reserve', component.tabBar.reserve],
]);
export const appThemeStyle = Object.entries(appCSSVars)
  .map(([key, value]) => `${key}:${value}`)
  .join(';');

export const darkColors: Record<keyof typeof semantic.color, string> = {
  brand: '#b5a7ff',
  'brand-pressed': '#cec4ff',
  'brand-light': '#342956',
  'brand-soft-pressed': '#453768',
  page: '#171622',
  surface: '#222131',
  'surface-muted': '#2c2a3c',
  ink: '#f3f1fa',
  secondary: '#c3bcd5',
  muted: '#a79fba',
  border: '#3e3952',
  'control-border': '#48415d',
  success: '#99e5bb',
  'success-soft': '#203930',
  warning: '#ffcf7b',
  'warning-soft': '#413321',
  danger: '#ff9eb1',
  'danger-soft': '#482837',
  night: '#17182d',
  lime: '#b8f36b',
  'on-brand': '#21183a',
};

export const appColor = Object.fromEntries(
  Object.keys(semantic.color).map((name) => [name, `var(--app-${name})`]),
) as Record<keyof typeof semantic.color, string>;
export const appLightStyle = `${appThemeStyle};color-scheme:light;--app-search-surface:rgba(255,255,255,.64);--app-frosted:rgba(255,255,255,.88);--app-glass:rgba(255,255,255,.72);--app-glass-shadow:${component.glass.shadow};--app-soft-glow:rgba(210,220,251,.35);--app-soft-glow-alt:rgba(228,219,249,.25);--app-picker-mask-start:rgba(255,255,255,.93);--app-picker-mask-end:rgba(255,255,255,.18)`;
export const appDarkStyle =
  Object.entries(darkColors)
    .map(([name, value]) => `--app-${name}:${value}`)
    .join(';') +
  ';color-scheme:dark;--app-search-surface:#292638;--app-frosted:rgba(35,32,50,.96);--app-glass:rgba(36,32,52,.78);--app-glass-shadow:0 8px 26px rgba(0,0,0,.32);--app-soft-glow:rgba(65,53,109,.35);--app-soft-glow-alt:rgba(48,35,79,.35);--app-picker-mask-start:rgba(34,33,49,.93);--app-picker-mask-end:rgba(34,33,49,.18)';
