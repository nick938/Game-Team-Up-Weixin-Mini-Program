import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

test('publish blocks empty join method before any write', async () => {
  const h = harness(), page = h.page('pages/publish/publish');
  Object.assign(page.state, { gameName: 'CS2', roomNo: '   ' });
  await page.onSubmit();
  assert.equal(h.calls.length, 0);
  assert.ok(h.toasts.includes('请填写房间 / 加入方式'));
});

test('mine switches hosted/joined and ongoing/history independently', () => {
  const h = harness(), page = h.page('pages/mine/mine');
  Object.assign(page.state, { hostedOngoing: [{ id: 'hosted' }], joinedPast: [{ id: 'past' }] });
  page.updateVisibleTeams();
  assert.equal(page.state.visibleTeams[0].id, 'hosted');
  page.pickTeamTab({ currentTarget: { dataset: { tab: 'joined' } } });
  page.pickPhase({ currentTarget: { dataset: { phase: 'Past' } } });
  assert.equal(page.state.visibleTeams[0].id, 'past');
});

test('dataset adapter preserves object, numeric and boolean values', () => {
  const h = harness(), { eventWithDataset } = h.load('utils/state');
  const host = { userId: 'u_test', nickName: '玩家' };
  const event = eventWithDataset({ detail: { value: true }, currentTarget: { dataset: { hours: '2' } } }, { hours: 2, host });
  assert.equal(event.currentTarget.dataset.hours, 2);
  assert.equal(event.currentTarget.dataset.host, host);
  assert.equal(event.detail.value, true);
});

test('team card emits the actual team id and game name', () => {
  const h = harness(), card = h.page('components/team-card/index', { team: { _id: 'team-id', gameName: 'CS2' }, teamId: '', mark: '' });
  card.onTap();
  assert.deepEqual(h.emitted, [{ name: 'open', detail: { id: 'team-id', gameName: 'CS2' } }]);
});
