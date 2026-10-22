import { useConfigProvider } from '@wot-ui/ui';
import { wotThemeVars } from '../design/wot-theme';

/** Called in the logical owner of page slots and portal content. */
export function useAppTheme() {
  useConfigProvider({ theme: 'light', themeVars: wotThemeVars, button: { round: false } });
}
