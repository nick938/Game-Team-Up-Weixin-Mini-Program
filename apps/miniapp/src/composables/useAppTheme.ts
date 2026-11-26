import { useConfigProvider } from '@wot-ui/ui';
import { appTheme } from '../utils/app-theme';
import { wotThemeVars } from '../design/wot-theme';

/** Called in the logical owner of page slots and portal content. */
export function useAppTheme() {
  useConfigProvider({ theme: appTheme, themeVars: wotThemeVars, button: { round: false } });
}
