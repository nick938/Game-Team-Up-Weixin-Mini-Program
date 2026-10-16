// Reduced from the unibest base template; preserve existing screen styles during migration.
import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';
import { presetUni } from '@uni-helper/unocss-preset-uni';
import { presetLegacyCompat } from '@unocss/preset-legacy-compat';
export default defineConfig({
  presets: [presetUni({ attributify: false }), presetLegacyCompat({ commaStyleColorFunction: true, legacyColorSpace: true })],
  transformers: [transformerDirectives(), transformerVariantGroup()],
});
