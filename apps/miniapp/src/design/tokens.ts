/** Pure design source shared by Vite, native navigation and runtime components. */
export const primitive = {
  color: {
    violet: '#6255E7',
    violetPressed: '#5144CC',
    lavender: '#EEECFF',
    lavenderPressed: '#DED9FF',
    white: '#FFFFFF',
    page: '#F5F6FA',
    surfaceMuted: '#F0F1F6',
    border: '#E4E7EF',
    ink: '#202438',
    secondary: '#596174',
    tertiary: '#687085',
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
    'control-border': primitive.color.tertiary,
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
  avatar: { size: '48px', radius: primitive.radius.control },
  layer: { sheet: 1100, picker: 1200, dialog: 1400, toast: 1500 },
} as const;

export const appCSSVars = Object.fromEntries([
  ...Object.entries(semantic.color).map(([name, value]) => [`--app-${name}`, value]),
  ['--app-content-max', semantic.layout.contentMax],
  ['--app-card-radius', component.card.radius],
  ['--app-sheet-radius', component.sheet.radius],
]);
export const appThemeStyle = Object.entries(appCSSVars)
  .map(([key, value]) => `${key}:${value}`)
  .join(';');
