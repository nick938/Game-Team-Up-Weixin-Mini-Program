const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./support/miniapp.cjs');
test('single-page detection supports old timeline scenes while explicit normal mode wins', () => {
  const { isSinglePage } = harness().load('utils/runtime');
  assert.equal(isSinglePage({ mode: 'singlePage' }), true);
  assert.equal(isSinglePage({ scene: 1154 }), true);
  assert.equal(isSinglePage({ mode: 'default', scene: 1154 }), false);
  assert.equal(isSinglePage({ scene: 1007 }), false);
});
for (const launch of [{ mode: 'singlePage', scene: 1154 }, { scene: 1154 }]) {
  test(`timeline startup avoids business requests and welcome storage: ${JSON.stringify(launch)}`, async () => {
    const h = harness({ launch });
    const app = h.page('App'); app.hooks.onLaunch(launch); await h.application.profileReady;
    for (const name of ['index/index', 'team/detail', 'mine/mine', 'publish/publish', 'game/game']) {
      const page = h.page('pages/' + name);
      page.hooks.onLoad?.(name === 'game/game' ? { game: 'cs2' } : { id: 'team-123' });
      await page.hooks.onShow(); await page.hooks.onPullDownRefresh?.();
      assert.equal(page.state.singlePage, true);
    }
    const welcome = h.page('components/welcome-letter/index'); welcome.hooks.mounted(); welcome.hooks.onShow();
    assert.equal(welcome.state.show, false); assert.deepEqual(h.calls, []); assert.equal(h.storage.size, 0);
  });
}
test('normal startup initializes the cloud and loads the profile and lobby', async () => {
  const h = harness(), app = h.page('App'); app.hooks.onLaunch({}); await h.application.profileReady;
  const page = h.page('pages/index/index'); await page.loadList();
  const welcome = h.page('components/welcome-letter/index'); welcome.hooks.mounted();
  assert.equal(welcome.state.show, true);
  for (const action of ['cloud.init', 'getProfile', 'listTeams']) assert.ok(h.calls.some(call => call.action === action));
  assert.deepEqual(h.toasts, []);
});
