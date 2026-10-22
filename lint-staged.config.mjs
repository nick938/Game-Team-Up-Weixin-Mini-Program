export default {
  "apps/miniapp/**/*.{ts,vue,mjs}": [
    "pnpm --filter game-team-miniapp exec eslint --config eslint.config.mjs --fix",
    "pnpm --filter game-team-miniapp exec prettier --write",
  ],
  "apps/miniapp/**/*.{json,md}":
    "pnpm --filter game-team-miniapp exec prettier --write",
};
