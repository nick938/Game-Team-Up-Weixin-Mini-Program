import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const plan = {
  id: 'plan-test-123',
  gameName: 'CS2',
  hostOpenid: 'host',
  startTime: '21:00',
  endTime: '23:00',
  capacity: 4,
  platform: 'Steam',
  voice: '不限',
  enabled: true,
};
test('admin chooses an eligible host, saves a stable plan and preserves it across a failed request', async () => {
  let failing = true;
  const h = harness({
    callTeam: async (action) => {
      if (action === 'adminUsers')
        return {
          list: [
            { _id: 'host', openid: 'host', nickName: '车头' },
            { _id: 'banned', nickName: '车头二', banned: true },
          ],
        };
      if (action === 'adminFixedTeams') return { list: [] };
      if (failing) throw new Error('网络失败');
      return { generationErrors: [] };
    },
  });
  const page = h.page('components/admin-fixed-teams/index');
  await page.load();
  page.edit();
  page.bindings.hostKeyword.value = '车头';
  assert.equal(page.bindings.matchingHosts.value.length, 1);
  page.chooseHost(page.bindings.matchingHosts.value[0]);
  assert.equal(page.form.hostOpenid, 'host');
  page.form.gameName = 'CS2';
  const id = page.form.id;
  await page.save();
  assert.equal(page.bindings.editing.value, true);
  assert.equal(page.form.id, id);
  failing = false;
  await page.save();
  assert.equal(page.bindings.editing.value, false);
  assert.equal(h.calls.filter((c) => c.action === 'adminSaveFixedTeam').length, 2);
  assert.ok(h.calls.filter((c) => c.action === 'adminSaveFixedTeam').every((c) => c.input.plan.id === id));
});
test('committed save with a generation failure is reported separately and does not invite duplicate plans', async () => {
  const alerts = [];
  const h = harness({
    dialog: { alert: async (input) => alerts.push(input) },
    callTeam: async (action) => {
      if (action === 'adminSaveFixedTeam')
        return { generationErrors: [{ id: plan.id, message: '车头已封禁' }] };
      return { list: [] };
    },
  });
  const page = h.page('components/admin-fixed-teams/index');
  page.edit(plan);
  await page.save();
  assert.equal(page.bindings.editing.value, false);
  assert.match(alerts[0].title, /已保存/);
  assert.match(alerts[0].msg, /封禁/);
});
test('cancelled pause does not mutate the plan', async () => {
  const h = harness({
    dialog: {
      confirm: async () => {
        throw new Error('cancel');
      },
    },
  });
  const page = h.page('components/admin-fixed-teams/index');
  await page.toggle(plan);
  assert.equal(h.calls.filter((c) => c.action === 'adminSetFixedTeamEnabled').length, 0);
});
test('personal fixed car and group requests explain the service and copy the author WeChat only after confirmation', async () => {
  const confirmations = [];
  const copied = [];
  let cancelled = false;
  const h = harness({
    platform: { setClipboardData: (input) => copied.push(input.data) },
    dialog: {
      confirm: async (input) => {
        confirmations.push(input);
        if (cancelled) throw new Error('cancel');
      },
    },
  });
  const page = h.page('pages/mine/mine').bindings.page;
  page.openAuthor('fixed');
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(confirmations[0].msg, /每天固定发车/);
  page.openAuthor('group');
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(confirmations[1].msg, /群组标识/);
  assert.deepEqual(copied, ['Louisville_k', 'Louisville_k']);
  cancelled = true;
  page.openAuthor('group');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(copied.length, 2);
});

test('time picker writes the selected field and the schedule explains overnight duration', () => {
  const page = harness().page('components/admin-fixed-teams/index');
  page.edit(plan);
  page.bindings.timePicker.value = 'startTime';
  page.confirmTime({ value: '23:30' });
  page.bindings.timePicker.value = 'endTime';
  page.confirmTime({ value: '01:00' });
  assert.equal(page.form.startTime, '23:30');
  assert.equal(page.form.endTime, '01:00');
  assert.equal(page.bindings.durationText.value, '共1小时30分钟');
  assert.equal(page.bindings.timePicker.value, '');
});
test('fixed plan cannot be saved without a game, host or distinct start/end times', async () => {
  const h = harness();
  const page = h.page('components/admin-fixed-teams/index');
  page.edit();
  await page.save();
  page.form.gameName = 'CS2';
  await page.save();
  page.form.hostOpenid = 'host';
  page.form.endTime = page.form.startTime;
  await page.save();
  assert.equal(h.calls.filter((call) => call.action === 'adminSaveFixedTeam').length, 0);
  assert.deepEqual(h.toasts, ['请填写游戏名称', '请选择车头', '开始和结束时间不能相同']);
});
test('selected host shows current profile data and excludes users without a real nickname', async () => {
  const host = {
    _id: 'host',
    openid: 'host',
    nickName: '车头',
    avatarUrl: 'https://example.test/avatar.png',
    steamFriendCode: '001234',
    wechatId: 'game_host',
    groupIds: ['underground-gaming'],
  };
  const h = harness({
    callTeam: async (action) => ({
      list:
        action === 'adminUsers' ? [host, { _id: 'empty', nickName: '未填写昵称', profileReady: false }] : [],
    }),
  });
  const page = h.page('components/admin-fixed-teams/index');
  await page.load();
  page.edit(plan);
  assert.deepEqual(page.bindings.selectedHost.value, host);
  page.bindings.hostKeyword.value = '未填写';
  assert.equal(page.bindings.matchingHosts.value.length, 0);
});
