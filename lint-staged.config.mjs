export default {
  'apps/miniapp/**/*.{ts,vue,mjs}': [
    'node apps/miniapp/node_modules/eslint/bin/eslint.js --config apps/miniapp/eslint.config.mjs --fix',
    'node apps/miniapp/node_modules/prettier/bin/prettier.cjs --write',
  ],
  'apps/miniapp/**/*.{json,md}': 'node apps/miniapp/node_modules/prettier/bin/prettier.cjs --write',
};
