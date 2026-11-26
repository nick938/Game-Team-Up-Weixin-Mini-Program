import { computed, ref, watch } from 'vue';
import { appDarkStyle, appLightStyle, darkColors, semantic } from '../design/tokens';

type Theme = 'light' | 'dark';
type ThemePreference = 'system' | Theme;
const storageKey = 'app-theme-preference';
const systemTheme = ref<Theme>('light');
const preference = ref<ThemePreference>('system');

export const themePreference = computed(() => preference.value);
export const appTheme = computed(() =>
  preference.value === 'system' ? systemTheme.value : preference.value,
);
export const pageThemeStyle = computed(() => (appTheme.value === 'dark' ? appDarkStyle : appLightStyle));
export const pageThemeBackground = computed(() =>
  appTheme.value === 'dark' ? darkColors.page : semantic.color.page,
);
export const pageThemeForeground = computed(() => (appTheme.value === 'dark' ? '#ffffff' : '#000000'));

export function selectAppTheme(value: string | number) {
  if (value !== 'light' && value !== 'dark' && value !== 'system') return;
  preference.value = value;
  try {
    uni.setStorageSync(storageKey, value);
  } catch {
    // Keep the selected appearance for the current session.
  }
}

export function syncAppTheme() {
  if (__BUILD_TARGET__ === 'mp-qq') return;
  // #ifdef H5
  if (__BUILD_TARGET__ === 'h5' && typeof window !== 'undefined' && window.matchMedia) {
    systemTheme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return;
  }
  // #endif
  systemTheme.value = uni.getSystemInfoSync?.().theme === 'dark' ? 'dark' : 'light';
}

export function initializeAppTheme() {
  try {
    const saved = uni.getStorageSync(storageKey);
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference.value = saved;
  } catch {
    // Follow the system if local storage is unavailable.
  }
  syncAppTheme();
  if (__BUILD_TARGET__ !== 'mp-qq') {
    uni.onThemeChange?.(({ theme }) => {
      systemTheme.value = theme === 'dark' ? 'dark' : 'light';
    });
  }
  // #ifdef H5
  if (__BUILD_TARGET__ === 'h5' && typeof document !== 'undefined') {
    watch(
      appTheme,
      (theme) => {
        document.documentElement.dataset.appTheme = theme;
      },
      { immediate: true },
    );
  }
  // #endif
}
