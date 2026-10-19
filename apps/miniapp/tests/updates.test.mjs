import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

test('returning users see the latest announcement once without resetting the welcome', () => {
  const h = harness();
  h.storage.set('welcomeLetterV2', 1);
  const first = h.page('components/welcome-letter/index');
  first.hooks.mounted();
  assert.equal(first.state.mode, 'update');
  assert.equal(first.state.show, true);
  first.dismiss();
  first.afterLeave();
  const next = h.page('components/welcome-letter/index');
  next.hooks.mounted();
  assert.equal(next.state.show, false);
  const updates = h.load('utils/updates');
  assert.equal(updates.hasReadUpdate(updates.LATEST_UPDATE.id), true);
  assert.equal(updates.hasReadUpdate('a-future-update'), false, 'a new announcement has its own read state');
});

test('new users read the welcome and update together without a second popup', () => {
  const h = harness();
  const page = h.page('components/welcome-letter/index');
  page.hooks.mounted();
  assert.equal(page.state.mode, 'welcome');
  page.dismiss();
  page.hooks.onShow();
  assert.equal(page.state.show, false);
  assert.equal(h.storage.get('welcomeLetterV2'), 1);
  const updates = h.load('utils/updates');
  assert.equal(updates.hasReadUpdate(updates.LATEST_UPDATE.id), true);
});

test('opening announcements waits for the popup to leave and restores tabs before navigating', () => {
  const order = [];
  const h = harness({
    platform: {
      showTabBar: () => order.push('tabs'),
      navigateTo: ({ url }) => order.push(url),
    },
  });
  h.storage.set('welcomeLetterV2', 1);
  const popup = h.page('components/welcome-letter/index');
  popup.hooks.mounted();
  popup.openUpdates();
  assert.deepEqual(order, []);
  popup.afterLeave();
  assert.deepEqual(order, ['tabs', '/pages/updates/updates']);
});

test('reading the update page records the announcement and both permanent entries navigate there', () => {
  const h = harness();
  h.storage.set('welcomeLetterV2', 1);
  const updates = h.page('pages/updates/updates');
  updates.hooks.onShow();
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, false);
  h.page('pages/mine/mine').openUpdates();
  assert.equal(h.navigation.at(-1), '/pages/updates/updates');
  h.page('pages/help/help').open('updates/updates');
  assert.equal(h.navigation.at(-1), '/pages/updates/updates');
});

test('storage failure does not repeat an acknowledged announcement in the same session', () => {
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
  const updates = h.load('utils/updates');
  updates.markUpdateRead(updates.LATEST_UPDATE.id);
  assert.equal(updates.hasReadUpdate(updates.LATEST_UPDATE.id), true);
});

test('timeline previews neither show nor mark update announcements', () => {
  const h = harness({ launch: { scene: 1154 } });
  h.storage.set('welcomeLetterV2', 1);
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, false);
  h.page('pages/updates/updates').hooks.onShow();
  assert.equal(h.storage.size, 1);
});
