const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function backend({ teams = [], members = [], users = [], send = async () => {} } = {}) {
  const db = {
    command: { gte: () => ({ and: () => ({}) }), lte: () => ({}) },
    collection(name) {
      return {
        where() { return this; }, limit() { return this; },
        async get() { return { data: name === 'teams' ? teams : name === 'users' ? users : members }; },
        doc(id) {
          const rows = name === 'teams' ? teams : name === 'users' ? users : members;
          return {
            async get() { return { data: rows.find(x => x._id === id) }; },
            async update({ data }) { Object.assign(rows.find(x => x._id === id), data); },
            async set({ data }) { rows.push({ _id: id, ...data }); },
          };
        },
      };
    },
  };
  const cloud = { init() {}, database: () => db, openapi: { subscribeMessage: { send } } };
  const ctx = { require: () => cloud, exports: {}, console: { error() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cloudfunctions/team/index.js'), 'utf8'), ctx);
  return ctx;
}

test('same nickname cannot claim an unidentified team; authoritative owner wins', async () => {
  const ctx = backend({ members: [{ role: 'host', openid: 'other' }] });
  assert.equal(await ctx.isTeamHost({ hostNickName: 'same' }, 'visitor', 't', [{ role: 'host', nickName: 'same' }]), false);
  assert.equal(await ctx.isTeamHost({ openid: 'owner' }, 'other', 't'), false);
  assert.equal(await ctx.isTeamHost({ openid: 'owner' }, 'owner', 't'), true);
  assert.notEqual(ctx.memberKey({ _id: 'a', nickName: 'same' }, {}), ctx.memberKey({ _id: 'b', nickName: 'same' }, {}));
});

test('reminder retries failed recipients without resending successful ones', async () => {
  const team = { _id: 't', gameName: 'CS2', startAt: Date.now() + 240000, endAt: Date.now() + 7200000, status: 'recruiting', openid: 'host' };
  const calls = [];
  let failing = true;
  const ctx = backend({ teams: [team], members: [{ openid: 'host' }, { openid: 'guest' }], send: async ({ touser }) => {
    calls.push(touser);
    if (touser === 'guest' && failing) throw new Error('temporary failure');
  } });
  await ctx.remindStartingTeams();
  assert.equal(team.startRemindedAt, undefined);
  assert.deepEqual([...team.startRemindedOpenids], ['host']);
  failing = false;
  await ctx.remindStartingTeams();
  assert.ok(team.startRemindedAt);
  await ctx.remindStartingTeams();
  assert.deepEqual(calls, ['host', 'guest', 'guest']);
  assert.equal(ctx.stripSecret(team, false).startRemindedOpenids, undefined);
});

test('expired teams do not receive start reminders', async () => {
  let calls = 0;
  const ctx = backend({ teams: [{ _id: 't', status: 'recruiting', startAt: Date.now(), endAt: Date.now() - 1 }], send: async () => { calls++; } });
  await ctx.remindStartingTeams();
  assert.equal(calls, 0);
});

test('joining requests authorization first and still joins after rejection', async () => {
  let page;
  const calls = [];
  const ctx = {
    Page: p => { page = p; },
    require: name => name.endsWith('/subscribe') ? { requestTeamNotify: async () => { calls.push('authorize'); return false; } } : name.endsWith('/cloud') ? { callTeam: async () => { calls.push('join'); }, showError: e => { throw e; } } : {},
    wx: { showLoading() {}, hideLoading() {}, showToast() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/team/detail.js'), 'utf8'), ctx);
  page.data = { teamId: 't' };
  page.loadDetail = () => {};
  await page.onJoin();
  assert.deepEqual(calls, ['authorize', 'join']);
  assert.equal(page.joining, false);
});

test('reminder query covers five minutes ahead and timer runs every minute', async () => {
  const ctx = backend();
  const before = Date.now();
  let upper;
  ctx.dbCapture = value => { upper = value; return {}; };
  vm.runInContext('_.lte = dbCapture', ctx);
  await ctx.remindStartingTeams();
  assert.ok(upper >= before + 300000 && upper <= Date.now() + 300000);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/team/config.json')));
  assert.equal(config.triggers[0].config, '0 */1 * * * * *');
});

test('parallel identical reads share a request; completed reads and writes are fresh', async () => {
  let count = 0;
  let finish;
  const ctx = { module: { exports: {} }, wx: { cloud: { callFunction() {
    count++;
    return new Promise(resolve => { finish = () => resolve({ result: { ok: true } }); });
  } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/utils/cloud.js'), 'utf8'), ctx);
  const call = ctx.module.exports.callTeam;
  const a = call('getTeam', { teamId: 't' });
  const b = call('getTeam', { teamId: 't' });
  assert.equal(a, b);
  assert.equal(count, 1);
  finish(); await a;
  const c = call('getTeam', { teamId: 't' });
  assert.equal(count, 2);
  finish(); await c;
  const d = call('joinTeam', { teamId: 't' });
  const finishD = finish;
  const e = call('joinTeam', { teamId: 't' });
  assert.equal(count, 4);
  finishD(); finish(); await Promise.all([d, e]);
});

test('cloud preference stops sends and survives nickname edits', async () => {
  const users = [{ _id: 'u', _openid: 'u', nickName: 'before' }];
  let sends = 0;
  const ctx = backend({ users, send: async () => { sends++; } });
  assert.equal((await ctx.saveNotifyPreference({ enabled: false }, 'u')).ok, true);
  await ctx.sendSubscribe('u', 't', 'CS2', '即将开打', Date.now());
  assert.equal(sends, 0);
  await ctx.saveProfile({ nickName: 'after' }, 'u');
  assert.equal(users[0].notifyEnabled, false);
  assert.equal(users[0].nickName, 'after');
  await ctx.saveNotifyPreference({ enabled: true }, 'u');
  await ctx.sendSubscribe('u', 't', 'CS2', '即将开打', Date.now());
  assert.equal(sends, 1);
  assert.equal((await ctx.saveNotifyPreference({ enabled: 'yes' }, 'u')).ok, false);
});

test('preference can be saved before profile and is read back', async () => {
  const users = [];
  const ctx = backend({ users });
  await ctx.saveNotifyPreference({ enabled: false }, 'new');
  assert.equal((await ctx.getProfile('new')).user.notifyEnabled, false);
  await ctx.saveProfile({ nickName: 'new player' }, 'new');
  assert.equal(users.length, 1);
  assert.equal(users[0].notifyEnabled, false);
});

test('disabled preference skips native subscription; explicit enable requests it synchronously', async () => {
  let calls = 0;
  const ctx = {
    module: { exports: {} }, require: () => ({ SUBSCRIBE_TMPL_ID: 'template' }),
    getApp: () => ({ globalData: { user: { notifyEnabled: false } } }),
    wx: { requestSubscribeMessage({ success }) { calls++; success({ template: 'accept' }); } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/utils/subscribe.js'), 'utf8'), ctx);
  const request = ctx.module.exports.requestTeamNotify;
  assert.equal(await request(), false);
  assert.equal(calls, 0);
  const explicit = request({ force: true });
  assert.equal(calls, 1);
  assert.equal(await explicit, true);
});

function settingsPage({ accepted = true, saveFails = false } = {}) {
  let page;
  const writes = [];
  const app = { globalData: { user: { notifyEnabled: false } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/mine/mine.js'), 'utf8'), {
    Page: value => { page = value; }, getApp: () => app,
    require: name => name.endsWith('/subscribe') ? { requestTeamNotify: async () => accepted }
      : name.endsWith('/cloud') ? { showError() {}, callTeam: async (type, data) => {
        writes.push([type, data]);
        if (saveFails) throw new Error('network');
        return { user: { notifyEnabled: data.enabled } };
      } } : {},
    wx: { getSetting({ success }) { success({ subscriptionsSetting: {} }); } },
  });
  page.setData = patch => Object.assign(page.data, patch);
  page.data.preferenceLoaded = true;
  return { page, app, writes };
}

test('rejecting native authorization does not enable or save preference', async () => {
  const { page, writes } = settingsPage({ accepted: false });
  await page.onNotifyChange({ detail: { value: true } });
  assert.equal(page.data.notifyEnabled, false);
  assert.equal(page.data.notifySaving, false);
  assert.equal(writes.length, 0);
});

test('preference save failure restores switch; success updates shared preference', async () => {
  const failed = settingsPage({ saveFails: true });
  await failed.page.onNotifyChange({ detail: { value: true } });
  assert.equal(failed.page.data.notifyEnabled, false);
  assert.equal(failed.app.globalData.user.notifyEnabled, false);
  const good = settingsPage();
  await good.page.onNotifyChange({ detail: { value: true } });
  assert.equal(good.page.data.notifyEnabled, true);
  assert.equal(good.app.globalData.user.notifyEnabled, true);
});

test('mine tabs keep hosted/joined and ongoing/history lists separate', () => {
  const { page } = settingsPage();
  Object.assign(page.data, { hostedOngoing: ['h-now'], hostedPast: ['h-old'], joinedOngoing: ['j-now'], joinedPast: ['j-old'] });
  page.updateVisibleTeams();
  assert.deepEqual(page.data.visibleTeams, ['h-now']);
  page.pickTeamTab({ currentTarget: { dataset: { tab: 'joined' } } });
  assert.deepEqual(page.data.visibleTeams, ['j-now']);
  page.pickPhase({ currentTarget: { dataset: { phase: 'Past' } } });
  assert.deepEqual(page.data.visibleTeams, ['j-old']);
  page.pickTeamTab({ currentTarget: { dataset: { tab: 'hosted' } } });
  assert.deepEqual(page.data.visibleTeams, ['h-old']);
});

test('manage menu is host-only and dispatches selected operation', () => {
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/team/detail.js'), 'utf8'), {
    Page: value => { page = value; }, require: () => ({}),
  });
  page.setData = patch => Object.assign(page.data, patch);
  page.data.role = 'member';
  page.onManage();
  assert.equal(page.data.showManage, false);
  page.data.role = 'host';
  page.onManage();
  assert.equal(page.data.showManage, true);
  let selected;
  page.onRepublish = () => { selected = 'republish'; };
  page.onManageAction({ currentTarget: { dataset: { action: 'republish' } } });
  assert.equal(selected, 'republish');
  assert.equal(page.data.showManage, false);
});

test('public profile saves string IDs, preserves omitted fields and allows explicit clearing', async () => {
  const users = [{ _id: 'u', nickName: '玩家', notifyEnabled: false }];
  const ctx = backend({ users });
  assert.equal((await ctx.saveProfile({ nickName: '玩家', steamFriendCode: ' 001234 ', gameId: '游戏名', kookId: 'abc', bio: '晚上在线' }, 'u')).ok, true);
  assert.equal(users[0].steamFriendCode, '001234');
  await ctx.saveProfile({ nickName: '新昵称' }, 'u');
  assert.equal(users[0].gameId, '游戏名');
  assert.equal(users[0].notifyEnabled, false);
  await ctx.saveProfile({ nickName: '新昵称', steamFriendCode: '', gameId: '', kookId: '', bio: '' }, 'u');
  assert.equal(users[0].steamFriendCode, '');
  assert.equal(users[0].bio, '');
});

test('invalid public fields fail before changing account data', async () => {
  const users = [{ _id: 'u', nickName: '原昵称' }];
  const ctx = backend({ users });
  for (const fields of [{ steamFriendCode: 123 }, { steamFriendCode: 'abc' }, { gameId: 'x'.repeat(41) }, { bio: 'x'.repeat(81) }]) {
    assert.equal((await ctx.saveProfile({ nickName: '新昵称', ...fields }, 'u')).ok, false);
    assert.equal(users[0].nickName, '原昵称');
  }
});

test('room profile returns only current public fields and rejects unrelated members', async () => {
  const users = [{ _id: 'u', _openid: 'secret', nickName: '最新昵称', steamFriendCode: '00123', notifyEnabled: false, privateField: 'secret' }];
  const ctx = backend({ teams: [{ _id: 't', gameName: 'CS2' }], members: [{ _id: 'm', teamId: 't', openid: 'u', nickName: '旧昵称' }, { _id: 'other', teamId: 'another', openid: 'u' }], users });
  const result = await ctx.getPublicProfile({ teamId: 't', memberId: 'm' });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.profile).sort(), ['avatarUrl', 'bio', 'gameId', 'kookId', 'nickName', 'steamFriendCode'].sort());
  assert.equal(result.profile.nickName, '最新昵称');
  assert.equal(result.profile.steamFriendCode, '00123');
  users[0].steamFriendCode = '';
  assert.equal((await ctx.getPublicProfile({ teamId: 't', memberId: 'm' })).profile.steamFriendCode, '');
  assert.equal((await ctx.getPublicProfile({ teamId: 't', memberId: 'other' })).ok, false);
  assert.equal((await ctx.getPublicProfile({ teamId: 't', memberId: 'missing' })).ok, false);
});

test('switching or closing member card ignores stale responses and copies ID intact', async () => {
  let page;
  const pending = [], copied = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/team/detail.js'), 'utf8'), {
    Page: value => { page = value; },
    require: () => ({ callTeam: () => new Promise(resolve => pending.push(resolve)) }),
    wx: { setClipboardData: ({ data }) => copied.push(data) },
  });
  page.setData = patch => Object.assign(page.data, patch);
  page.data.selectedMemberId = 'first';
  const first = page.loadMemberProfile();
  page.data.selectedMemberId = 'second';
  const second = page.loadMemberProfile();
  pending[1]({ profile: { nickName: 'second', steamFriendCode: '00123' } });
  await second;
  pending[0]({ profile: { nickName: 'first' } });
  await first;
  assert.equal(page.data.memberProfile.nickName, 'second');
  page.copyPublicField({ currentTarget: { dataset: { field: 'steamFriendCode' } } });
  assert.deepEqual(copied, ['00123']);
  const closed = page.loadMemberProfile();
  page.closeMemberProfile();
  pending[2]({ profile: { nickName: 'late' } });
  await closed;
  assert.equal(page.data.memberProfile, null);
  assert.equal(page.data.showMemberProfile, false);
});
