import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const { nextTick } = require('../node_modules/vue');

test('startup and mine share one profile request, refresh bypasses the short cache', async () => {
  let finish;
  const h = harness({
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const { loadMyProfile } = h.load('utils/my-profile');
  const a = loadMyProfile(),
    b = loadMyProfile();
  assert.equal(a, b);
  assert.equal(h.calls.length, 1);
  finish({ user: { nickName: '玩家', avatarUrl: 'first' } });
  await a;
  await loadMyProfile();
  assert.equal(h.calls.length, 1);
  const c = loadMyProfile(true);
  assert.equal(h.calls.length, 2);
  finish({ user: { nickName: '玩家', avatarUrl: 'new' } });
  await c;
  assert.equal(h.store.user.avatarUrl, 'new');
  const mine = h.page('pages/mine/mine');
  assert.equal(mine.state.user.avatarUrl, 'new');
});
test('profile saved during startup wins over a late response; failed requests can retry', async () => {
  let finish;
  const h = harness({
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const { loadMyProfile } = h.load('utils/my-profile');
  const pending = loadMyProfile();
  h.store.user = { nickName: '刚保存', avatarUrl: 'saved' };
  finish({ user: { nickName: '旧资料', avatarUrl: 'old' } });
  assert.equal((await pending).user.avatarUrl, 'saved');
  let attempts = 0;
  const f = harness({
    callTeam: async () => {
      if (!attempts++) throw new Error('offline');
      return { user: { nickName: '重试' } };
    },
  });
  const load = f.load('utils/my-profile').loadMyProfile;
  await assert.rejects(load());
  assert.equal((await load()).user.nickName, '重试');
});
test('team publishing no longer assigns user group membership to a team', () => {
  const h = harness();
  const page = h.page('pages/publish/publish');
  page.applyDraft({ gameName: 'CS2', platform: 'Steam', capacity: 5, sourceGroup: '旧来源群' });
  assert.equal('sourceGroup' in page.buildTeam(), false);
  const detail = h.page('pages/team/detail');
  detail.state.team = { _id: 't', gameName: 'CS2', sourceGroup: '旧来源群' };
  detail.onRepublish();
  assert.equal('sourceGroup' in h.store.republishTeam, false);
});
test('card reactions combine dimensions optimistically, roll back failures and ignore another team response', async () => {
  let finish, reject;
  const h = harness({
    callTeam: () =>
      new Promise((resolve, fail) => {
        finish = resolve;
        reject = fail;
      }),
  });
  const card = h.page('components/team-card/index', { team: { _id: 't' } });
  const reactions = card.bindings.reactions;
  const pending = reactions.react('like');
  assert.deepEqual([...reactions.state.summary.selected], ['like']);
  assert.equal(reactions.state.summary.counts.like, 1);
  await reactions.react('love');
  assert.equal(h.calls.length, 1);
  finish({ reactions: { counts: { like: 2 }, selected: ['like'], mine: 'like' } });
  await pending;
  const busy = reactions.react('next');
  assert.deepEqual([...reactions.state.summary.selected], ['like', 'next']);
  assert.equal(h.calls[1].input.enabled, true);
  reject(new Error('offline'));
  await busy;
  assert.deepEqual([...reactions.state.summary.selected], ['like']);
  assert.equal(reactions.state.summary.counts.next, 0);
  assert.equal(reactions.state.pulse, '');
  const switched = reactions.react('dislike');
  assert.deepEqual([...reactions.state.summary.selected], ['dislike']);
  assert.equal(reactions.state.summary.counts.like, 1);
  finish({ reactions: { counts: { like: 1, dislike: 1 }, selected: ['dislike'], mine: 'dislike' } });
  await switched;
  const cancel = reactions.react('dislike');
  assert.equal(h.calls[3].input.enabled, false);
  assert.deepEqual([...reactions.state.summary.selected], []);
  finish({ reactions: { counts: { like: 1, dislike: 0 }, selected: [], mine: '' } });
  await cancel;
  const changed = reactions.react('love');
  card.bindings.props.team = { _id: 'other' };
  await new Promise((resolve) => setImmediate(resolve));
  finish({ reactions: { counts: { love: 1 }, selected: ['love'], mine: 'love' } });
  await changed;
  assert.deepEqual([...reactions.state.summary.selected], []);
  assert.equal(h.emitted.length, 0);
});

test('saved profile invalidates bootstrap cache and appears while the team list is still pending', async () => {
  let current = { nickName: '旧资料' };
  let finishTeams;
  const h = harness({
    callTeam: async (action) =>
      action === 'myTeams'
        ? new Promise((resolve) => {
            finishTeams = resolve;
          })
        : { user: current },
  });
  const { loadMyProfile } = h.load('utils/my-profile');
  await loadMyProfile();
  const mine = h.page('pages/mine/mine');
  const loading = mine.load();
  current = { nickName: '刚保存' };
  h.store.user = current;
  await loadMyProfile();
  await nextTick();
  // The real Pinia store is reactive; harness state is intentionally plain.
  assert.equal(h.calls.filter((call) => call.action === 'getProfile').length, 2);
  finishTeams({ hosted: [], joined: [] });
  await loading;
  assert.equal(h.store.user.nickName, '刚保存');
});
test('real Vue proxies reuse bootstrap cache and update mine before its team list resolves', async () => {
  const { reactive } = require('../node_modules/vue');
  const store = reactive({ user: null, isAdmin: false, isOrganizer: false });
  let finish;
  const h = harness({
    overrides: { 'stores/app': { useAppStore: () => store } },
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const mine = h.page('pages/mine/mine');
  const load = h.load('utils/my-profile').loadMyProfile;
  const pending = load();
  finish({ user: { nickName: '启动完成', avatarUrl: 'cached' } });
  await pending;
  await nextTick();
  assert.equal(mine.state.user.avatarUrl, 'cached');
  await load();
  assert.equal(h.calls.length, 1, 'proxy identity must not bypass the cache');
});

test('reaction effects play immediately, expire once, cancel quietly and clean up when hidden or unmounted', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish;
  const h = harness({
    callTeam: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const card = h.page('components/team-card/index', { team: { _id: 'motion' } });
  const reactions = card.bindings.reactions;
  const settle = async (pending) => {
    finish({ reactions: JSON.parse(JSON.stringify(reactions.state.summary)) });
    await pending;
  };
  for (const [id, duration] of [
    ['like', 550],
    ['dislike', 300],
    ['love', 500],
    ['next', 750],
  ]) {
    const pending = reactions.react(id);
    assert.equal(reactions.state.pulse, id);
    assert.equal(reactions.state.summary.selected.includes(id), true);
    const serial = reactions.state.effectId;
    await settle(pending);
    assert.equal(reactions.state.effectId, serial, 'server acknowledgement never starts another animation');
    t.mock.timers.tick(duration - 1);
    assert.equal(reactions.state.pulse, id);
    t.mock.timers.tick(1);
    assert.equal(reactions.state.pulse, '');
    assert.equal(
      reactions.state.summary.selected.includes(id),
      true,
      'cleanup does not cancel the actual feedback',
    );
  }
  const cancelled = reactions.react('next');
  assert.equal(reactions.state.pulse, '');
  assert.equal(reactions.state.cancelPulse, 'next');
  await settle(cancelled);
  t.mock.timers.tick(180);
  assert.equal(reactions.state.cancelPulse, '');
  const fly = reactions.react('next');
  card.hooks.onHide();
  assert.equal(reactions.state.pulse, '');
  await settle(fly);
  assert.equal(reactions.state.pulse, '', 'hidden cards do not replay late server responses');
  const unlike = reactions.react('dislike');
  card.hooks.unmounted();
  await settle(unlike);
  assert.equal(reactions.state.pulse, '');
  assert.equal(reactions.state.cancelPulse, '');
});
