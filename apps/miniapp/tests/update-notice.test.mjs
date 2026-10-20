import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('returning users skip welcome and see an independent update notice once', () => {
  const h = harness();
  h.storage.set('welcomeLetterV2', 1);
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, false);
  const notice = h.page('components/update-notice/index', { enabled: true });
  notice.hooks.mounted();
  assert.equal(notice.state.show, true);
  notice.dismiss();
  notice.afterLeave();
  const next = h.page('components/update-notice/index', { enabled: true });
  next.hooks.mounted();
  assert.equal(next.state.show, false);
  assert.equal(h.storage.get('welcomeLetterV2'), 1);
});

test('a first visit shows welcome then update only after the welcome has left', async () => {
  const h = harness();
  const welcome = h.page('components/welcome-letter/index');
  const notice = h.page('components/update-notice/index', { enabled: false });
  welcome.hooks.mounted();
  notice.hooks.mounted();
  assert.equal(welcome.state.show, true);
  assert.equal(notice.state.show, false);
  const updates = h.load('utils/update-notice');
  welcome.dismiss();
  assert.equal(h.storage.get('welcomeLetterV2'), 1);
  assert.equal(updates.hasReadUpdate(), false, 'welcome does not acknowledge updates');
  assert.equal(
    h.emitted.some((event) => event.name === 'ready'),
    false,
  );
  welcome.afterLeave();
  assert.equal(h.emitted.at(-1).name, 'ready');
  notice.bindings.props.enabled = true;
  await flush();
  assert.equal(notice.state.show, true);
  notice.dismiss();
  assert.equal(updates.hasReadUpdate(), true);
  const nextWelcome = h.page('components/welcome-letter/index');
  nextWelcome.hooks.mounted();
  assert.equal(nextWelcome.state.show, false);
});

test('acknowledging updates never marks the first-visit welcome as read', () => {
  const h = harness();
  const notice = h.page('components/update-notice/index', { enabled: true });
  notice.hooks.mounted();
  notice.dismiss();
  assert.equal(h.storage.has('welcomeLetterV2'), false);
});

test('a new release version notifies again without resetting welcome', () => {
  const h = harness();
  h.storage.set('welcomeLetterV2', 1);
  const updates = h.load('utils/update-notice');
  updates.markUpdateRead();
  assert.equal(updates.hasReadUpdate('9.9.9'), false);
  const upgraded = harness({
    overrides: {
      'utils/changelog': {
        CHANGELOG: [
          {
            version: '9.9.9',
            date: '2026-10-20',
            title: '下一次更新',
            highlights: [{ title: '新功能', description: '说明' }],
            sections: [{ title: '新增', items: ['新功能'] }],
          },
        ],
      },
    },
  });
  for (const [key, value] of h.storage) upgraded.storage.set(key, value);
  const welcome = upgraded.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, false);
  const notice = upgraded.page('components/update-notice/index', { enabled: true });
  notice.hooks.mounted();
  assert.equal(notice.state.show, true);
  assert.equal(upgraded.load('utils/update-notice').LATEST_RELEASE.version, '9.9.9');
});

test('opening the changelog restores tabs after the notice leaves, before navigating', () => {
  const order = [];
  const h = harness({
    platform: {
      showTabBar: () => order.push('tabs'),
      navigateTo: ({ url }) => order.push(url),
    },
  });
  const notice = h.page('components/update-notice/index', { enabled: true });
  notice.hooks.mounted();
  notice.openChangelog();
  assert.deepEqual(order, []);
  notice.afterLeave();
  assert.deepEqual(order, ['tabs', '/pages/changelog/changelog']);
});

test('reading the changelog acknowledges updates without affecting welcome, and entries remain reachable', () => {
  const h = harness();
  h.page('pages/changelog/changelog').hooks.onShow();
  assert.equal(h.storage.has('welcomeLetterV2'), false);
  const notice = h.page('components/update-notice/index', { enabled: true });
  notice.hooks.mounted();
  assert.equal(notice.state.show, false);
  h.page('pages/mine/mine').openChangelog();
  assert.equal(h.navigation.at(-1), '/pages/changelog/changelog');
  h.page('pages/help/help').open('changelog/changelog');
  assert.equal(h.navigation.at(-1), '/pages/changelog/changelog');
});

test('the notice and the changelog page read the same latest release', () => {
  const h = harness();
  const { CHANGELOG } = h.load('utils/changelog');
  const { LATEST_RELEASE } = h.load('utils/update-notice');
  assert.equal(LATEST_RELEASE, CHANGELOG[0]);
  assert.ok(LATEST_RELEASE.highlights.length > 0);
  assert.ok(LATEST_RELEASE.sections.length > 0);
});

test('storage failure does not repeat acknowledged welcome or announcements in this session', () => {
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
  const updates = h.load('utils/update-notice');
  const welcome = h.load('utils/welcome');
  updates.markUpdateRead();
  welcome.markWelcomeRead();
  assert.equal(updates.hasReadUpdate(), true);
  assert.equal(welcome.hasReadWelcome(), true);
});

test('timeline previews show neither welcome nor updates and mark neither read', () => {
  const h = harness({ launch: { scene: 1154 } });
  const welcome = h.page('components/welcome-letter/index');
  welcome.hooks.mounted();
  const notice = h.page('components/update-notice/index', { enabled: true });
  notice.hooks.mounted();
  assert.equal(welcome.state.show, false);
  assert.equal(notice.state.show, false);
  h.page('pages/changelog/changelog').hooks.onShow();
  assert.equal(h.storage.size, 0);
});
