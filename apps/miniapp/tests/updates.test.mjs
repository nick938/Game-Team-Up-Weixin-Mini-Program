import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

test('announcements and changelog remain reachable from their manual entries', () => {
  const h = harness();
  h.page('pages/mine/mine').openUpdates();
  assert.equal(h.navigation.at(-1), '/pages/updates/updates');
  h.page('pages/updates/updates').openChangelog();
  assert.equal(h.navigation.at(-1), '/pages/changelog/changelog');
  assert.ok(h.load('utils/updates').UPDATES.length > 0);
  assert.equal(h.storage.size, 0);
});

test('the first-visit welcome still appears once', () => {
  const h = harness();
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, true);
  welcome.dismiss();
  welcome.afterLeave();
  const next = h.page('components/welcome-letter/index');
  next.hooks.mounted();
  assert.equal(next.state.show, false);
  assert.equal(h.storage.get('welcomeLetterV2'), 1);
});

test('storage failure does not repeat the acknowledged welcome in this session', () => {
  const h = harness({
    platform: {
      getStorageSync() {
        throw new Error('unavailable');
      },
      setStorageSync() {
        throw new Error('unavailable');
      },
    },
  });
  const welcome = h.load('utils/welcome');
  welcome.markWelcomeRead();
  assert.equal(welcome.hasReadWelcome(), true);
});

test('timeline previews skip the welcome without writing storage', () => {
  const h = harness({ launch: { scene: 1154 } });
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, false);
  assert.equal(h.storage.size, 0);
});
