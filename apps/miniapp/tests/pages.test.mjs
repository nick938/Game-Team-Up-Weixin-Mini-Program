import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

test('publish blocks empty join method before any write', async () => {
  const h = harness(),
    page = h.page('pages/publish/publish');
  Object.assign(page.state, { gameName: 'CS2', roomNo: '   ' });
  await page.onSubmit();
  assert.equal(h.calls.length, 0);
  assert.ok(h.toasts.includes('请填写房间 / 加入方式'));
});

test('mine switches hosted/joined and ongoing/history independently', () => {
  const h = harness(),
    page = h.page('pages/mine/mine');
  Object.assign(page.state, { hostedOngoing: [{ id: 'hosted' }], joinedPast: [{ id: 'past' }] });
  page.updateVisibleTeams();
  assert.equal(page.state.visibleTeams[0].id, 'hosted');
  page.pickTeamTab('joined');
  page.pickPhase('Past');
  assert.equal(page.state.visibleTeams[0].id, 'past');
});

test('proxy host selection keeps the actual object and switch accepts a boolean', () => {
  const page = harness().page('pages/publish/publish');
  page.state.canProxy = true;
  page.toggleProxy(true);
  page.pickProxyHost({ userId: 'u_test', nickName: '玩家' });
  assert.equal(page.state.proxyHost.userId, 'u_test');
  page.toggleProxy(false);
  assert.equal(page.state.proxyMode, false);
});

test('team card emits the actual team id and game name', () => {
  const h = harness(),
    card = h.page('components/team-card/index', {
      team: { _id: 'team-id', gameName: 'CS2' },
      teamId: '',
      mark: '',
    });
  card.onTap();
  assert.deepEqual(h.emitted, [{ name: 'open', detail: { id: 'team-id', gameName: 'CS2' } }]);
});

test('Wot datetime and duration selection preserve the selected start and derive the end', () => {
  const page = harness().page('pages/publish/publish');
  const start = new Date(2026, 9, 17, 23, 30).getTime();
  page.changeStart(start);
  page.changeDuration(90);
  assert.equal(page.state.startDate, '2026-10-17');
  assert.equal(page.state.startTime, '23:30');
  assert.equal(page.state.endDate, '2026-10-18');
  assert.equal(page.state.endTime, '01:00');
  assert.equal(page.state.durationMinutes, 90);
  page.changeDuration(-1);
  assert.equal(page.state.durationMinutes, 90);
});

test('canceling the Wot leave confirmation performs no write; confirming leaves once', async () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const canceled = harness({ dialog: { confirm: () => Promise.reject(new Error('cancel')) } });
  canceled.page('pages/team/detail').onLeave();
  await flush();
  assert.equal(canceled.calls.length, 0);
  const confirmed = harness();
  const page = confirmed.page('pages/team/detail');
  page.state.teamId = 'team-1';
  page.onLeave();
  await flush();
  assert.deepEqual(
    confirmed.calls.filter((call) => call.action === 'leaveTeam'),
    [{ action: 'leaveTeam', input: { teamId: 'team-1' } }],
  );
});

test('Wot single-column picker adapts array values and ignores an empty confirmation', () => {
  const h = harness();
  const picker = h.page('components/app-picker/index', {
    label: '平台',
    modelValue: 'Steam',
    columns: ['Steam', '主机'],
  });
  picker.confirm({ value: [] });
  assert.equal(h.emitted.length, 0);
  picker.confirm({ value: ['主机'] });
  assert.deepEqual(h.emitted, [
    { name: 'update:modelValue', detail: '主机' },
    { name: 'confirm', detail: { value: '主机' } },
  ]);
});

test('nested Wot overlays hide the native tab bar until the last overlay closes or unmounts', () => {
  let hidden = 0,
    shown = 0;
  const h = harness({ platform: { hideTabBar: () => hidden++, showTabBar: () => shown++ } });
  const first = h.page('components/app-picker/index', { label: '平台', columns: ['Steam'] });
  const second = h.page('components/app-datetime-picker/index', { label: '日期', modelValue: Date.now() });
  assert.equal(hidden, 0);
  first.view.visible = true;
  second.view.visible = true;
  assert.equal(hidden, 1);
  first.view.visible = false;
  assert.equal(shown, 0);
  second.hooks.unmounted();
  assert.equal(shown, 1);
});
