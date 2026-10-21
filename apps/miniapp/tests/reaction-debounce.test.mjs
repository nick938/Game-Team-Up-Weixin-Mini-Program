import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const flush = () => new Promise((resolve) => setImmediate(resolve));
function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests = [];
  const h = harness({ callTeam: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) });
  const card = h.page('components/team-card/index', { team: { _id: 't' } });
  return { h, card, reactions: card.bindings.reactions, requests };
}
const result = (mine, counts = {}) => ({ reactions: { counts, selected: mine ? [mine] : [], mine } });

test('rapid clicks stay optimistic and submit only the final selection after 500ms', async (t) => {
  const { h, reactions, requests } = setup(t);
  reactions.react('like');
  t.mock.timers.tick(300);
  reactions.react('dislike');
  t.mock.timers.tick(300);
  reactions.react('love');
  assert.deepEqual([...reactions.state.summary.selected], ['love']);
  assert.equal(reactions.state.summary.counts.like, 0);
  assert.equal(reactions.state.summary.counts.dislike, 0);
  assert.equal(reactions.state.summary.counts.love, 1);
  t.mock.timers.tick(499);
  assert.equal(h.calls.length, 0);
  t.mock.timers.tick(1);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].input, { teamId: 't', reaction: 'love' });
  requests[0].resolve(result('love', { love: 1 }));
  await flush();
  assert.equal(reactions.state.pending, false);
});

test('in-flight writes are serialized and old responses rebase counts without replacing newer clicks', async (t) => {
  const { h, reactions, requests } = setup(t);
  reactions.react('like');
  t.mock.timers.tick(500);
  reactions.react('dislike');
  t.mock.timers.tick(250);
  reactions.react('next');
  t.mock.timers.tick(500);
  assert.equal(h.calls.length, 1);
  requests[0].resolve(result('like', { like: 2 }));
  await flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].input.reaction, 'next');
  assert.deepEqual([...reactions.state.summary.selected], ['next']);
  assert.equal(reactions.state.summary.counts.like, 1);
  requests[1].resolve(result('next', { like: 1, next: 1 }));
  await flush();
  assert.equal(reactions.state.pending, false);
  reactions.react('next');
  t.mock.timers.tick(500);
  assert.equal(h.calls[2].input.reaction, '');
  requests[2].reject(new Error('offline'));
  await flush();
  assert.deepEqual([...reactions.state.summary.selected], ['next']);
  assert.equal(reactions.state.pulse, '');
  assert.ok(h.toasts.includes('offline'));
});

test('an older failure never rolls back newer intent and detached responses cannot overwrite a new card', async (t) => {
  const { h, card, reactions, requests } = setup(t);
  reactions.react('like');
  t.mock.timers.tick(500);
  reactions.react('love');
  t.mock.timers.tick(500);
  requests[0].reject(new Error('old failure'));
  await flush();
  assert.deepEqual([...reactions.state.summary.selected], ['love']);
  assert.equal(h.toasts.length, 0);
  assert.equal(h.calls[1].input.reaction, 'love');
  card.bindings.props.team = { _id: 'new' };
  await flush();
  requests[1].resolve(result('love', { love: 1 }));
  await flush();
  assert.deepEqual([...reactions.state.summary.selected], []);
});

test('a burst ending at the saved choice skips the request; hiding flushes the final unsent choice once', async (t) => {
  const { h, card, reactions, requests } = setup(t);
  reactions.react('like');
  reactions.react('like');
  t.mock.timers.tick(500);
  assert.equal(h.calls.length, 0);
  assert.equal(reactions.state.pending, false);
  reactions.react('next');
  card.hooks.onHide();
  assert.equal(h.calls.length, 1);
  card.hooks.unmounted();
  requests[0].resolve(result('next', { next: 1 }));
  await flush();
  t.mock.timers.tick(1000);
  assert.equal(h.calls.length, 1);
});

test('unmounting during a request still saves its queued final choice without touching a new card', async (t) => {
  const { h, card, reactions, requests } = setup(t);
  reactions.react('like');
  t.mock.timers.tick(500);
  reactions.react('love');
  card.hooks.unmounted();
  assert.equal(reactions.state.pulse, '');
  requests[0].resolve(result('like', { like: 1 }));
  await flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].input.reaction, 'love');
  requests[1].resolve(result('love', { love: 1 }));
  await flush();
  assert.equal(reactions.state.pulse, '');
});

test('a newer click arriving during a request waits for its own full debounce delay', async (t) => {
  const { h, reactions, requests } = setup(t);
  reactions.react('like');
  t.mock.timers.tick(500);
  reactions.react('love');
  t.mock.timers.tick(100);
  requests[0].resolve(result('like', { like: 1 }));
  await flush();
  assert.equal(h.calls.length, 1);
  t.mock.timers.tick(399);
  assert.equal(h.calls.length, 1);
  t.mock.timers.tick(1);
  assert.equal(h.calls.length, 2);
  requests[1].resolve(result('love', { love: 1 }));
  await flush();
});

test('animations start immediately, expire on time and never replay on acknowledgement', async (t) => {
  const { card, reactions, requests } = setup(t);
  for (const [id, duration] of [
    ['like', 550],
    ['dislike', 300],
    ['love', 500],
    ['next', 750],
  ]) {
    reactions.react(id);
    assert.equal(reactions.state.pulse, id);
    const serial = reactions.state.effectId;
    t.mock.timers.tick(duration - 1);
    assert.equal(reactions.state.pulse, id);
    t.mock.timers.tick(1);
    assert.equal(reactions.state.pulse, '');
    if (duration < 500) t.mock.timers.tick(500 - duration);
    requests.at(-1).resolve({ reactions: JSON.parse(JSON.stringify(reactions.state.summary)) });
    await flush();
    assert.equal(reactions.state.effectId, serial);
    assert.equal(reactions.state.pulse, '');
  }
  reactions.react('next');
  assert.equal(reactions.state.cancelPulse, 'next');
  t.mock.timers.tick(180);
  assert.equal(reactions.state.cancelPulse, '');
  card.hooks.onHide();
  requests.at(-1).resolve(result(''));
  await flush();
  assert.equal(reactions.state.pulse, '');
});
