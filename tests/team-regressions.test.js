const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function backend({ teams = [], members = [], users = [], feedback = [], reports = [], rateLimits = [], admins = [], send = async () => {}, env = {}, sendMail, imgCheck, msgCheck } = {}) {
  const tables = { teams, members, users, feedback, reports, rate_limits: rateLimits, admins };
  const deleted = [];
  const db = {
    command: { gte: () => ({ and: () => ({}) }), lte: () => ({}), in: () => ({}) },
    collection(name) {
      const rows = tables[name] || (tables[name] = []);
      return {
        where() { return this; }, limit() { return this; }, orderBy() { return this; },
        async get() { return { data: rows }; },
        async add({ data }) {
          const _id = `${name}_${rows.length + 1}`;
          rows.push({ _id, ...data });
          return { _id };
        },
        doc(id) {
          return {
            async get() { return { data: rows.find(x => x._id === id) }; },
            async update({ data }) { Object.assign(rows.find(x => x._id === id) || {}, data); },
            async remove() {
              const at = rows.findIndex(x => x._id === id);
              if (at >= 0) rows.splice(at, 1);
            },
            async set({ data }) {
              const found = rows.find(x => x._id === id);
              if (found) Object.assign(found, data);
              else rows.push({ _id: id, ...data });
            },
          };
        },
      };
    },
    async runTransaction(fn) { return fn(this); },
  };
  const cloud = {
    init() {},
    database: () => db,
    openapi: {
      subscribeMessage: { send },
      security: {
        imgSecCheck: imgCheck || (async () => ({ errCode: 0 })),
        msgSecCheck: msgCheck || (async () => ({ errCode: 0, result: { suggest: 'pass' } })),
      },
    },
    async getTempFileURL({ fileList }) {
      return {
        fileList: (fileList || []).map((fileID) => ({ fileID, tempFileURL: `https://tmp.example/${fileID}` })),
      };
    },
    async downloadFile() { return { fileContent: Buffer.from('image-bytes') }; },
    async deleteFile({ fileList }) { deleted.push(...(fileList || [])); return {}; },
  };
  const ctx = {
    require: (id) => {
      if (id === "nodemailer") {
        return { createTransport: () => ({ sendMail: sendMail || (async () => ({})) }) };
      }
      if (String(id).includes("mail.local")) throw new Error("no local mail");
      return cloud;
    },
    exports: {},
    console: { error() {} },
    process: { env: env || {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cloudfunctions/team/index.js'), 'utf8'), ctx);
  ctx.deletedFiles = deleted;
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

test('start reminders ignore the legacy notify flag and always notify everyone', async () => {
  const team = { _id: 't', gameName: 'CS2', startAt: Date.now() + 240000, endAt: Date.now() + 7200000, status: 'recruiting', openid: 'host' };
  const calls = [];
  const ctx = backend({
    teams: [team],
    members: [{ openid: 'host' }, { openid: 'guest' }],
    users: [{ _id: 'host', notifyEnabled: true }, { _id: 'guest', notifyEnabled: false }],
    send: async ({ touser }) => { calls.push(touser); },
  });
  await ctx.remindStartingTeams();
  assert.ok(team.startRemindedAt);
  assert.deepEqual([...calls].sort(), ['guest', 'host']);
  await ctx.remindStartingTeams();
  assert.deepEqual([...calls].sort(), ['guest', 'host']);
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

test('share, copy-link and scene entry all keep the team id', async () => {
  const { resolveTeamId, teamShareQuery } = require(path.join(root, 'miniprogram/utils/team-entry.js'));
  assert.equal(resolveTeamId({ id: 'team-1' }), 'team-1');
  assert.equal(resolveTeamId({ teamId: 'team-2' }), 'team-2');
  assert.equal(resolveTeamId({ scene: 'id%3Dteam-3' }), 'team-3');
  assert.equal(resolveTeamId({}, { enter: { query: { id: 'team-4' } } }), 'team-4');
  assert.equal(resolveTeamId({}), '');
  assert.equal(teamShareQuery('abc'), 'id=abc');

  let page;
  let copyHandler;
  const ctx = {
    Page: p => { page = p; },
    require: (name) => {
      if (name.endsWith('/subscribe')) return { requestTeamNotify: async () => false };
      if (name.endsWith('/cloud')) return { callTeam: async () => ({}), showError() {} };
      return require(path.resolve(root, 'miniprogram/pages/team', name));
    },
    wx: {
      onCopyUrl(fn) { copyHandler = fn; },
      offCopyUrl() { copyHandler = null; },
      getEnterOptionsSync: () => ({ query: {} }),
      getLaunchOptionsSync: () => ({ query: {} }),
      setNavigationBarTitle() {},
      showLoading() {},
      hideLoading() {},
      showToast() {},
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/team/detail.js'), 'utf8'), ctx);
  page.setData = function (patch) { Object.assign(this.data, patch); };
  page.loadDetail = async function () { this.setData({ loading: false }); };

  page.onLoad({ scene: 'id=isaac-team' });
  page.data.team = { gameName: '以撒的重生', displayStatus: 'recruiting', needCount: 2, startAt: Date.now() };
  page.onShow();
  assert.equal(page.data.teamId, 'isaac-team');
  assert.equal(copyHandler().query, 'id=isaac-team');
  assert.equal(copyHandler().title, '以撒的重生');
  assert.equal(page.onShareAppMessage().path, '/pages/team/detail?id=isaac-team');
  assert.equal(page.onShareTimeline().query, 'id=isaac-team');
  assert.equal(page.onShareTimeline().path, undefined);
});

test('plaza pages share into the lobby and timeline uses query not path', () => {
  const share = require(path.join(root, 'miniprogram/utils/share.js'));
  const plaza = share.plazaShare();
  assert.equal(plaza.path, '/pages/index/index');
  assert.equal(plaza.query, '');

  function loadPage(rel, extraRequire) {
    let page;
    vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), {
      Page: value => { page = value; },
      getApp: () => ({ globalData: {} }),
      require: extraRequire,
      wx: { onCopyUrl() {}, offCopyUrl() {} },
    });
    return page;
  }

  const index = loadPage('miniprogram/pages/index/index.js', (name) => {
    if (name.endsWith('/share')) return share;
    if (name.endsWith('/team-entry')) return require(path.join(root, 'miniprogram/utils/team-entry.js'));
    return { decorateTeam: (t) => t, callTeam: async () => ({}), showError() {} };
  });
  assert.equal(index.onShareAppMessage().path, '/pages/index/index');
  assert.equal(index.onShareTimeline().query, '');
  assert.equal(index.onShareTimeline().path, undefined);

  const publish = loadPage('miniprogram/pages/publish/publish.js', (name) => {
    if (name.endsWith('/share')) return share;
    if (name.endsWith('/constants')) return { PLATFORMS: ['Steam'], VOICES: ['KOOK'], MAX_TEAM_HOURS: 24 };
    if (name.endsWith('/format')) return { dateParts: () => ({ date: '2026-09-11', time: '21:00' }), combineDateTime: () => Date.now(), defaultStartAt: () => Date.now(), defaultEndAt: () => Date.now() };
    if (name.endsWith('/cloud')) return { callTeam: async () => ({}), showError() {} };
    if (name.endsWith('/subscribe')) return { requestTeamNotify: async () => true };
    if (name.endsWith('/team-entry')) return require(path.join(root, 'miniprogram/utils/team-entry.js'));
    return {};
  });
  assert.equal(publish.onShareAppMessage().path, '/pages/index/index');
  assert.equal(publish.onShareTimeline().query, '');
  assert.equal(publish.onShareTimeline().path, undefined);
  assert.match(publish.onShareAppMessage().title, /发起组队/);

  const { page: mine } = minePage();
  assert.equal(mine.onShareAppMessage().path, '/pages/index/index');
  assert.equal(mine.onShareTimeline().query, '');
  assert.equal(mine.onShareTimeline().path, undefined);

  for (const pagePath of ['index/index', 'publish/publish', 'mine/mine', 'team/detail']) {
    const json = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages', pagePath + '.json'), 'utf8'));
    assert.equal(json.enableShareAppMessage, true);
    assert.equal(json.enableShareTimeline, true);
  }
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  assert.equal(appJson['mp-weixin'], undefined);
});

test('lobby cards open with a real team id even if component objects drop _id', async () => {
  const { usableTeamId, teamDetailPath, resolveTeamId } = require(path.join(root, 'miniprogram/utils/team-entry.js'));
  assert.equal(usableTeamId('undefined'), '');
  assert.equal(usableTeamId('null'), '');
  assert.equal(resolveTeamId({ id: 'undefined' }), '');
  assert.match(teamDetailPath('abc', { gameName: '以撒' }), /teamId=abc/);
  assert.match(teamDetailPath('abc', { gameName: '以撒' }), /name=/);
  assert.equal(teamDetailPath('undefined'), '');

  let card;
  const events = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/components/team-card/index.js'), 'utf8'), {
    Component: value => { card = value; },
    require: (name) => name.endsWith('/team-entry') ? require(path.join(root, 'miniprogram/utils/team-entry.js')) : {},
  });
  card.data = { team: { gameName: '以撒' }, teamId: 'real-team', mark: '' };
  card.triggerEvent = (name, detail) => events.push([name, detail]);
  Object.assign(card, card.methods);
  card.onTap();
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'open');
  assert.equal(events[0][1].id, 'real-team');
  assert.equal(events[0][1].gameName, '以撒');

  card.data.teamId = '';
  card.data.team = { gameName: '以撒' };
  card.onTap();
  assert.equal(events.length, 1);

  let page;
  const urls = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8'), {
    Page: value => { page = value; },
    require: (name) => {
      if (name.endsWith('/team-entry')) return require(path.join(root, 'miniprogram/utils/team-entry.js'));
      if (name.endsWith('/share')) return require(path.join(root, 'miniprogram/utils/share.js'));
      return { decorateTeam: (t) => t, callTeam: async () => ({}), showError() {} };
    },
    wx: { navigateTo: ({ url }) => urls.push(url), onCopyUrl() {}, offCopyUrl() {} },
  });
  page.onOpen({ detail: { x: 10, y: 20 } });
  page.onOpen({ detail: { id: 'undefined' } });
  page.onOpen({ detail: { id: 'real-team', gameName: '以撒' } });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /id=real-team/);
  assert.match(urls[0], /teamId=real-team/);

  const ctx = backend({ teams: [{ _id: 't', gameName: '以撒', startAt: 1, endAt: Date.now() + 3600000, status: 'recruiting' }] });
  assert.equal(ctx.stripSecret({ _id: 't', gameName: '以撒', startAt: 1 }, false).id, 't');
  assert.match((await ctx.getTeam({ teamId: 'undefined' }, 'u')).errMsg, /缺少/);
  assert.equal((await ctx.getTeam({ teamId: 't' }, 'u')).ok, true);
});

test('empty team id does not query the cloud', async () => {
  let page;
  const cloudCalls = [];
  const ctx = {
    Page: p => { page = p; },
    require: (name) => {
      if (name.endsWith('/subscribe')) return { requestTeamNotify: async () => false };
      if (name.endsWith('/cloud')) return {
        callTeam: async (type, data) => { cloudCalls.push([type, data]); return { ok: true }; },
        showError() {},
      };
      return require(path.resolve(root, 'miniprogram/pages/team', name));
    },
    wx: {
      onCopyUrl() {},
      offCopyUrl() {},
      getEnterOptionsSync: () => ({ query: {} }),
      getLaunchOptionsSync: () => ({ query: {} }),
      setNavigationBarTitle() {},
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/team/detail.js'), 'utf8'), ctx);
  page.setData = function (patch) { Object.assign(this.data, patch); };
  page.onLoad({});
  page.onShow();
  await page.loadDetail();
  assert.equal(page.data.teamId, '');
  assert.equal(cloudCalls.length, 0);
  assert.equal(page.data.loading, false);
});

test('team detail prefers the current page query over the launch query', () => {
  let page;
  const ctx = {
    Page: p => { page = p; },
    require: (name) => {
      if (name.endsWith('/subscribe')) return { requestTeamNotify: async () => false };
      if (name.endsWith('/cloud')) return { callTeam: async () => ({}), showError() {} };
      return require(path.resolve(root, 'miniprogram/pages/team', name));
    },
    wx: {
      onCopyUrl() {},
      offCopyUrl() {},
      getEnterOptionsSync: () => ({ query: { id: 'from-launch' } }),
      getLaunchOptionsSync: () => ({ query: { id: 'from-launch' } }),
      setNavigationBarTitle() {},
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/team/detail.js'), 'utf8'), ctx);
  page.setData = function (patch) { Object.assign(this.data, patch); };
  page.loadDetail = function () {};
  page.options = { id: 'from-page' };
  page.onShow();
  assert.equal(page.data.teamId, 'from-page');
});

test('reminder query covers ten minutes ahead and five minutes past, timer runs every minute', async () => {
  const ctx = backend();
  const before = Date.now();
  let lower;
  let upper;
  ctx.dbCaptureLte = (value) => { upper = value; return {}; };
  ctx.dbCaptureGte = (value) => { lower = value; return { and: (x) => x }; };
  vm.runInContext('_.lte = dbCaptureLte; _.gte = dbCaptureGte', ctx);
  await ctx.remindStartingTeams();
  assert.ok(upper >= before + 600000 && upper <= Date.now() + 600000);
  assert.ok(lower <= before - 290000 && lower >= before - 310000);
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

test('there is no preference endpoint and sends go out unconditionally', async () => {
  const users = [{ _id: 'u', _openid: 'u', nickName: 'before', notifyEnabled: false }];
  let sends = 0;
  const ctx = backend({ users, send: async () => { sends++; } });
  assert.equal(await ctx.saveNotifyPreference, undefined);
  await ctx.sendSubscribe('u', 't', 'CS2', '即将开打', Date.now());
  assert.equal(sends, 1);
  await ctx.saveProfile({ nickName: 'after' }, 'u');
  assert.equal(users[0].nickName, 'after');
  assert.equal(users[0].notifyEnabled, false);
});

test('profile can be read back without any preference record', async () => {
  const users = [];
  const ctx = backend({ users });
  assert.equal(await ctx.saveNotifyPreference, undefined);
  await ctx.saveProfile({ nickName: 'new player' }, 'new');
  assert.equal(users.length, 1);
  assert.equal(users[0].notifyEnabled, undefined);
  assert.equal((await ctx.getProfile('new')).user.nickName, 'new player');
});

test('requestTeamNotify always asks the native panel and only trusts accept', async () => {
  let calls = 0;
  let answer = 'accept';
  const ctx = {
    module: { exports: {} }, require: () => ({ SUBSCRIBE_TMPL_ID: 'template' }),
    wx: { requestSubscribeMessage({ success }) { calls++; success({ template: answer }); } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/utils/subscribe.js'), 'utf8'), ctx);
  const request = ctx.module.exports.requestTeamNotify;
  assert.equal(await request(), true);
  assert.equal(calls, 1);
  answer = 'reject';
  assert.equal(await request(), false);
  assert.equal(calls, 2);
  assert.equal(ctx.module.exports.notifyPreferenceEnabled, undefined);
});

function minePage() {
  let page;
  const app = { globalData: { user: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/mine/mine.js'), 'utf8'), {
    Page: value => { page = value; }, getApp: () => app,
    require: name => name.endsWith('/format') ? { decorateTeam: (team) => team }
      : name.endsWith('/cloud') ? { showError() {}, callTeam: async () => ({ user: null }) }
      : name.endsWith('/version') ? { getAppVersion: () => ({ text: 'v0.6.0' }) }
      : name.endsWith('/share') ? require(path.join(root, 'miniprogram/utils/share.js'))
      : name.endsWith('/team-entry') ? require(path.join(root, 'miniprogram/utils/team-entry.js'))
      : {},
    wx: {},
  });
  page.setData = patch => Object.assign(page.data, patch);
  return { page, app };
}

test('mine page no longer exposes notification preference controls', () => {
  const { page } = minePage();
  assert.equal(page.onNotifyChange, undefined);
  assert.equal(page.toggleSettings, undefined);
  assert.equal(page.refreshWechatNotify, undefined);
  assert.equal(page.openWechatNotifySettings, undefined);
});

test('mine tabs keep hosted/joined and ongoing/history lists separate', () => {
  const { page } = minePage();
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

test('manage menu is host-only, drops republish, and dispatches edit/cancel', () => {
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
  page.onEdit = () => { selected = 'edit'; };
  page.onCancel = () => { selected = 'cancel'; };
  let republished = false;
  page.onRepublish = () => { republished = true; };
  page.onManageAction({ currentTarget: { dataset: { action: 'edit' } } });
  assert.equal(selected, 'edit');
  assert.equal(page.data.showManage, false);
  // 「再发一趟」已从管理菜单移除，不会再被派发。
  page.data.showManage = true;
  page.onManageAction({ currentTarget: { dataset: { action: 'republish' } } });
  assert.equal(republished, false);
  assert.equal(selected, 'edit');
});

test('public profile saves string IDs, preserves omitted fields and allows explicit clearing', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({ users });
  assert.equal((await ctx.saveProfile({ nickName: '玩家', steamFriendCode: ' 001234 ', gameId: '游戏名', kookId: 'abc', bio: '晚上在线' }, 'u')).ok, true);
  assert.equal(users[0].steamFriendCode, '001234');
  await ctx.saveProfile({ nickName: '新昵称' }, 'u');
  assert.equal(users[0].gameId, '游戏名');
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
  assert.deepEqual(Object.keys(result.profile).sort(), ['avatarUrl', 'avatarBase64', 'bio', 'gameId', 'kookId', 'nickName', 'steamFriendCode'].sort());
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

test('team duration cannot exceed 24 hours and allows exactly 24 hours', () => {
  const ctx = backend();
  const startAt = Date.now() + 60 * 1000;
  const tooLong = ctx.validateTeamInput({
    gameName: 'CS2',
    capacity: 5,
    startAt,
    endAt: startAt + 24 * 60 * 60 * 1000 + 1,
    platform: 'Steam',
    voice: 'KOOK',
  }, { isCreate: true });
  assert.equal(tooLong.error, '一局最长 24 小时');
  const ok = ctx.validateTeamInput({
    gameName: 'CS2',
    capacity: 5,
    startAt,
    endAt: startAt + 24 * 60 * 60 * 1000,
    platform: 'Steam',
    voice: 'KOOK',
  }, { isCreate: true });
  assert.equal(ok.error, undefined);
  assert.equal(ok.value.endAt - ok.value.startAt, 24 * 60 * 60 * 1000);
});

test('welcome letter shows once then stays dismissed', () => {
  const store = {};
  const navigated = [];
  const tabBar = [];
  let comp;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/components/welcome-letter/index.js'), 'utf8'), {
    Component: value => { comp = value; },
    wx: {
      getStorageSync: key => store[key],
      setStorageSync: (key, value) => { store[key] = value; },
      navigateTo: ({ url }) => navigated.push(url),
      hideTabBar: () => tabBar.push('hide'),
      showTabBar: () => tabBar.push('show'),
    },
  });
  comp.data = { show: false };
  comp.setData = patch => Object.assign(comp.data, patch);
  Object.assign(comp, comp.methods);
  comp.lifetimes.attached.call(comp);
  assert.equal(comp.data.show, true);
  assert.deepEqual(tabBar, ['hide']);
  comp.openRules();
  assert.equal(store.welcomeLetterV2, 1);
  assert.equal(comp.data.show, false);
  assert.deepEqual(navigated, ['/pages/legal/legal?type=community']);
  assert.deepEqual(tabBar, ['hide', 'show']);
  comp.lifetimes.attached.call(comp);
  assert.equal(comp.data.show, false);
  const other = { data: { show: true }, setData: patch => Object.assign(other.data, patch) };
  Object.assign(other, comp.methods, { lifetimes: comp.lifetimes, pageLifetimes: comp.pageLifetimes });
  other.pageLifetimes.show.call(other);
  assert.equal(other.data.show, false);
});

test('welcome letter can open feedback', () => {
  const store = {};
  const navigated = [];
  let comp;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/components/welcome-letter/index.js'), 'utf8'), {
    Component: value => { comp = value; },
    wx: {
      getStorageSync: key => store[key],
      setStorageSync: (key, value) => { store[key] = value; },
      navigateTo: ({ url }) => navigated.push(url),
      hideTabBar() {},
      showTabBar() {},
    },
  });
  comp.data = { show: true };
  comp.setData = patch => Object.assign(comp.data, patch);
  Object.assign(comp, comp.methods);
  comp.openFeedback();
  assert.equal(store.welcomeLetterV2, 1);
  assert.equal(comp.data.show, false);
  assert.deepEqual(navigated, ['/pages/feedback/feedback']);
});

function publishPage() {
  let page;
  const app = { globalData: { editingTeamId: null, republishTeam: null } };
  const calls = [];
  const now = Date.now();
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages/publish/publish.js'), 'utf8'), {
    Page: value => { page = value; },
    getApp: () => app,
    require: (name) => {
      if (name.endsWith('/constants')) return { PLATFORMS: ['Steam', '手游'], VOICES: ['KOOK', '开麦'], MAX_TEAM_HOURS: 24 };
      if (name.endsWith('/format')) {
        return {
          dateParts: (ts) => {
            const t = Number(ts) || now;
            return { date: '2026-09-09', time: t > now + 1800000 ? '22:00' : '21:00' };
          },
          combineDateTime: (date, time) => time === '22:00' ? now + 7200000 : now + 3600000,
          defaultStartAt: () => now + 60000,
          defaultEndAt: (start) => start + 3600000,
        };
      }
      if (name.endsWith('/cloud')) {
        return {
          callTeam: async (type, data) => {
            calls.push([type, data]);
            if (type === 'getTeam') {
              return {
                team: {
                  gameName: 'CS2',
                  startAt: now + 60000,
                  endAt: now + 7200000,
                  capacity: 5,
                  platform: 'Steam',
                  voice: 'KOOK',
                  roomNo: '',
                  roomPwd: '',
                  server: '',
                  rankReq: '',
                  note: '',
                },
              };
            }
            return { teamId: 'created' };
          },
          showError() {},
        };
      }
      if (name.endsWith('/subscribe')) return { requestTeamNotify: async () => true };
      if (name.endsWith('/share')) return require(path.join(root, 'miniprogram/utils/share.js'));
      if (name.endsWith('/team-entry')) return require(path.join(root, 'miniprogram/utils/team-entry.js'));
      return {};
    },
    wx: {
      showLoading() {},
      hideLoading() {},
      showToast() {},
      navigateTo() {},
    },
  });
  page.setData = (patch) => Object.assign(page.data, patch);
  return { page, app, calls };
}

test('editing a team survives a second onShow and updates instead of creating', async () => {
  const { page, app, calls } = publishPage();
  app.globalData.editingTeamId = 'team-1';
  await page.onShow();
  assert.equal(page.data.editingId, 'team-1');
  app.globalData.editingTeamId = null;
  await page.onShow();
  assert.equal(page.data.editingId, 'team-1');
  page.data.gameName = 'CS2';
  await page.onSubmit();
  assert.deepEqual(calls.map((item) => item[0]), ['getTeam', 'updateTeam']);
  assert.equal(calls[1][1].teamId, 'team-1');
  assert.equal(page.data.editingId, '');
});

test('successful create clears the form so a second submit does not post again', async () => {
  const { page, calls } = publishPage();
  page.data.gameName = 'CS2';
  await page.onSubmit();
  assert.equal(calls[0][0], 'createTeam');
  assert.equal(page.data.gameName, '');
  await page.onSubmit();
  assert.equal(calls.length, 1);
});

test('feedback rejects blank template, emails when SMTP is set, and cools down', async () => {
  const feedback = [];
  const mails = [];
  const ctx = backend({
    feedback,
    env: { SMTP_PASS: 'app-password' },
    sendMail: async (msg) => { mails.push(msg); },
  });
  assert.equal((await ctx.submitFeedback({
    kind: '遇到问题', page: '大厅', content: '【我遇到的情况】\n\n【我希望怎样】\n',
  }, 'u')).ok, false);
  const res = await ctx.submitFeedback({
    kind: '功能建议',
    page: '发车',
    content: '【我遇到的情况】发车页时间选不了\n【我希望怎样】能选到明天',
    version: '0.6.0',
    envVersion: '开发版',
  }, 'u');
  assert.equal(res.ok, true);
  assert.equal(res.mailed, true);
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0].kind, '功能建议');
  assert.equal(feedback[0].contact, undefined);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /功能建议/);
  assert.match(mails[0].text, /发车页时间选不了/);
  // 邮件不再携带任何身份信息（OpenID、手机号/微信号/邮箱等联系方式）。
  assert.doesNotMatch(mails[0].text, /OpenID/);
  assert.doesNotMatch(mails[0].text, /联系方式/);
  assert.equal((await ctx.submitFeedback({
    kind: '功能建议', page: '发车', content: '再来一条补充说明一下',
  }, 'u')).ok, false);
});

test('feedback is stored even if mail is not configured', async () => {
  const feedback = [];
  const ctx = backend({ feedback });
  const res = await ctx.submitFeedback({
    kind: '其他', page: '我的', content: '界面很好看想说一声',
  }, 'u');
  assert.equal(res.ok, true);
  assert.equal(res.mailed, false);
  assert.match(res.mailError, /未配置发信授权码/);
  assert.equal(feedback.length, 1);
});

test('feedback keeps the record and returns SMTP auth errors', async () => {
  const feedback = [];
  const ctx = backend({
    feedback,
    env: { SMTP_PASS: 'wrong-pass' },
    sendMail: async () => {
      const err = new Error('Invalid login: 535 5.7.8 Error: authentication failed');
      err.code = 'EAUTH';
      throw err;
    },
  });
  const res = await ctx.submitFeedback({
    kind: '其他', page: '我的', content: '界面很好看想说一声',
  }, 'u');
  assert.equal(res.ok, true);
  assert.equal(res.mailed, false);
  assert.match(res.mailError, /认证失败/);
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0].mailed, false);
});

test('started teams stay visible but are flagged and sink below upcoming ones', async () => {
  const now = Date.now();
  const startedTeam = {
    _id: 'started', gameName: 'CS2', capacity: 5, memberCount: 2, status: 'recruiting',
    openid: 'h1', startAt: now - 60000, endAt: now + 3600000,
  };
  const upcomingTeam = {
    _id: 'upcoming', gameName: 'CS2', capacity: 5, memberCount: 2, status: 'recruiting',
    openid: 'h2', startAt: now + 60000, endAt: now + 7200000,
  };
  const ctx = backend({ teams: [startedTeam, upcomingTeam] });
  assert.equal(ctx.stripSecret(startedTeam, false).started, true);
  assert.equal(ctx.stripSecret(upcomingTeam, false).started, false);
  const list = (await ctx.listTeams({}, '')).list;
  assert.equal(list.length, 2);
  // 已开始的车仍在列表中，但排在未开始的车后面。
  assert.deepEqual(list.map((t) => t._id), ['upcoming', 'started']);
  // 已取消 / 已过期不算「进行中」。
  assert.equal(ctx.stripSecret({ ...startedTeam, status: 'cancelled' }, false).started, false);
  assert.equal(ctx.stripSecret({ ...startedTeam, endAt: now - 1 }, false).started, false);
});

test('app version always comes from the build and only the env label varies', () => {
  let info = { envVersion: 'develop', version: '' };
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/utils/version.js'), 'utf8'), {
    require: () => ({ APP_VERSION: '0.7.0' }),
    module: mod,
    wx: { getAccountInfoSync: () => ({ miniProgram: info }) },
  });
  assert.equal(mod.exports.getAppVersion().text, 'v0.7.0 · 开发版');
  assert.equal(mod.exports.getAppVersion().version, '0.7.0');
  // 正式版忽略后台上传版本号，仍显示代码里的版本，保证开发版/正式版一致。
  info = { envVersion: 'release', version: '1.2.0' };
  assert.equal(mod.exports.getAppVersion().text, 'v0.7.0 · 正式版');
  info = { envVersion: 'trial', version: '0.7.0' };
  assert.equal(mod.exports.getAppVersion().text, 'v0.7.0 · 体验版');
});

test('permanent subscribe errors stop retrying inside the reminder window', async () => {
  const team = { _id: 't', gameName: 'CS2', startAt: Date.now() + 240000, endAt: Date.now() + 7200000, status: 'recruiting', openid: 'host' };
  const calls = [];
  const ctx = backend({
    teams: [team],
    members: [{ openid: 'host' }],
    users: [{ _id: 'host', notifyEnabled: true }],
    send: async ({ touser }) => {
      calls.push(touser);
      const err = new Error('no quota');
      err.errCode = 43101;
      throw err;
    },
  });
  await ctx.remindStartingTeams();
  assert.ok(team.startRemindedAt);
  await ctx.remindStartingTeams();
  assert.deepEqual(calls, ['host']);
});

test('member payloads never include OpenIDs and kick is gone', async () => {
  const team = {
    _id: 't', gameName: 'CS2', capacity: 5, memberCount: 2, status: 'recruiting',
    openid: 'host', startAt: Date.now(), endAt: Date.now() + 3600000,
    startRemindedAt: 1, startRemindedOpenids: ['host'],
  };
  const members = [
    { _id: 'm1', teamId: 't', openid: 'host', role: 'host' },
    { _id: 'm2', teamId: 't', openid: 'guest', role: 'member' },
  ];
  const ctx = backend({ teams: [team], members });
  assert.equal(await ctx.kickMember, undefined);
  for (const who of ['stranger', 'guest', 'host']) {
    const res = await ctx.getTeam({ teamId: 't' }, who);
    assert.equal(res.team.openid, undefined);
    assert.equal(res.team.startRemindedAt, undefined);
    assert.equal(res.members.every((m) => m.openid === undefined), true);
  }
  assert.equal((await ctx.getTeam({ teamId: 't' }, 'stranger')).role, null);
  assert.equal((await ctx.getTeam({ teamId: 't' }, 'guest')).role, 'member');
  assert.equal((await ctx.getTeam({ teamId: 't' }, 'host')).role, 'host');
});

test('oversized inline avatars are dropped to protect the response body', () => {
  const ctx = backend();
  assert.equal(ctx.safeAvatarBase64('abc'), 'abc');
  assert.equal(ctx.safeAvatarBase64('x'.repeat(200001)), '');
  assert.equal(ctx.safeAvatarBase64(undefined), '');
});

test('cloud fileIDs are exchanged for temp URLs on every read path', async () => {
  const users = [{ _id: 'host', _openid: 'host', nickName: '车头', avatarUrl: 'cloud://env/a.png' },
    { _id: 'guest', _openid: 'guest', nickName: '乘客', avatarUrl: 'cloud://env/b.png' }];
  const ctx = backend({
    users,
    teams: [{ _id: 't', gameName: 'CS2', capacity: 5, memberCount: 2, status: 'recruiting', openid: 'host', startAt: Date.now(), endAt: Date.now() + 3600000 }],
    members: [{ _id: 'm1', teamId: 't', openid: 'host', role: 'host' }, { _id: 'm2', teamId: 't', openid: 'guest', role: 'member' }],
  });
  const detail = await ctx.getTeam({ teamId: 't' }, 'host');
  assert.equal(detail.members.every((m) => m.avatarUrl.startsWith('https://tmp.example/')), true);
  const profile = await ctx.getPublicProfile({ teamId: 't', memberId: 'm2' });
  assert.equal(profile.profile.avatarUrl, 'https://tmp.example/cloud://env/b.png');
  assert.equal((await ctx.getProfile('guest')).user.avatarUrl, 'https://tmp.example/cloud://env/b.png');
  // 非 cloud:// 的旧值原样返回，不会被打断。
  assert.equal(ctx.withTempAvatar({}, 'wxfile://tmp_a.png'), 'wxfile://tmp_a.png');
});

test('saving a cloud avatar clears the legacy inline base64', async () => {
  const users = [{ _id: 'u', nickName: '玩家', avatarBase64: 'oldpayload' }];
  const ctx = backend({ users });
  await ctx.saveProfile({ nickName: '玩家', avatarUrl: 'cloud://env/new.png', avatarBase64: 'ignored' }, 'u');
  assert.equal(users[0].avatarUrl, 'cloud://env/new.png');
  assert.equal(users[0].avatarBase64, '');
});

test('a risky avatar is rejected and the uploaded file is deleted', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({
    users,
    imgCheck: async () => ({ errCode: 87014 }),
  });
  const res = await ctx.saveProfile({ nickName: '玩家', avatarUrl: 'cloud://env/bad.png' }, 'u');
  assert.equal(res.ok, false);
  assert.match(res.errMsg, /安全检测/);
  assert.equal(users[0].avatarUrl, undefined);
  assert.deepEqual(ctx.deletedFiles, ['cloud://env/bad.png']);
});

test('a safe avatar passes the check and is kept', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({ users });
  const res = await ctx.saveProfile({ nickName: '玩家', avatarUrl: 'cloud://env/ok.png' }, 'u');
  assert.equal(res.ok, true);
  assert.equal(users[0].avatarUrl, 'cloud://env/ok.png');
  assert.deepEqual(ctx.deletedFiles, []);
});

test('re-saving the same avatar skips a redundant security check', async () => {
  const users = [{ _id: 'u', nickName: '玩家', avatarUrl: 'cloud://env/ok.png' }];
  let checks = 0;
  const ctx = backend({ users, imgCheck: async () => { checks++; return { errCode: 0 }; } });
  await ctx.saveProfile({ nickName: '新昵称', avatarUrl: 'cloud://env/ok.png' }, 'u');
  assert.equal(checks, 0);
  assert.equal(users[0].nickName, '新昵称');
});

test('risky team text is rejected before the team is created', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const teams = [];
  const ctx = backend({
    users,
    teams,
    msgCheck: async () => ({ errCode: 0, result: { suggest: 'risky' } }),
  });
  const res = await ctx.createTeam({
    team: {
      gameName: '违规内容', capacity: 5,
      startAt: Date.now() + 60000, endAt: Date.now() + 3600000,
    },
  }, 'u');
  assert.equal(res.ok, false);
  assert.match(res.errMsg, /不允许发布/);
  assert.equal(teams.length, 0);
});

test('review-graded text is not treated as a violation', async () => {
  const users = [{ _id: 'v', nickName: '玩家2' }];
  const ctx = backend({ users, msgCheck: async () => ({ result: { suggest: 'review' } }) });
  const ok = await ctx.createTeam({
    team: { gameName: 'CS2', capacity: 5, startAt: Date.now() + 60000, endAt: Date.now() + 3600000 },
  }, 'v');
  assert.equal(ok.ok, true);
});

test('risk profile text is rejected and no user record is written', async () => {
  const users = [];
  const ctx = backend({ users, msgCheck: async () => ({ result: { suggest: 'risky' } }) });
  const res = await ctx.saveProfile({ nickName: '正常昵称', bio: '违规简介' }, 'new');
  assert.equal(res.ok, false);
  assert.match(res.errMsg, /不支持/);
  assert.equal(users.length, 0);
});

test('risky feedback is rejected and nothing is stored', async () => {
  const feedback = [];
  const ctx = backend({ feedback, msgCheck: async () => ({ result: { suggest: 'risky' } }) });
  const res = await ctx.submitFeedback({ kind: '其他', page: '我的', content: '违规内容在此' }, 'u');
  assert.equal(res.ok, false);
  assert.equal(feedback.length, 0);
});

test('a scanning outage does not block publishing', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({
    users,
    msgCheck: async () => { const e = new Error('timeout'); e.errCode = -1; throw e; },
  });
  const res = await ctx.createTeam({
    team: { gameName: 'CS2', capacity: 5, startAt: Date.now() + 60000, endAt: Date.now() + 3600000 },
  }, 'u');
  assert.equal(res.ok, true);
});

test('leaving a cancelled team reports it is dissolved, not merely ended', async () => {
  const ctx = backend({
    teams: [{ _id: 't', gameName: 'CS2', status: 'cancelled', memberCount: 2, capacity: 5, openid: 'host', startAt: Date.now(), endAt: Date.now() + 3600000 }],
    members: [{ _id: 'm1', teamId: 't', openid: 'host', role: 'host' }, { _id: 'm2', teamId: 't', openid: 'guest', role: 'member' }],
  });
  assert.match((await ctx.leaveTeam({ teamId: 't' }, 'guest')).errMsg, /散了/);
});

test('createTeam is rate limited after the configured burst', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const teams = [];
  const ctx = backend({ users, teams });
  const payload = {
    team: { gameName: 'CS2', capacity: 5, startAt: Date.now() + 60000, endAt: Date.now() + 3600000 },
  };
  const limit = 8; // RATE_LIMITS.createTeam.max
  for (let i = 0; i < limit; i += 1) {
    assert.equal((await ctx.createTeam(payload, 'u')).ok, true);
  }
  const blocked = await ctx.createTeam(payload, 'u');
  assert.equal(blocked.ok, false);
  assert.match(blocked.errMsg, /频繁/);
  assert.equal(teams.length, limit);
});

test('joinTeam is rate limited independently of creates', async () => {
  const now = Date.now();
  const limit = 6; // RATE_LIMITS.joinTeam.max
  // 同一用户短时间内连上多趟车：第 7 次被拦。每个上下文一所独立的车，共享限流记录。
  const rateLimits = [];
  const outcomes = [];
  for (let i = 0; i <= limit; i += 1) {
    const ctx = backend({
      users: [{ _id: 'u', nickName: '玩家' }],
      teams: [{ _id: `t${i}`, gameName: 'CS2', capacity: 5, memberCount: 1, status: 'recruiting', openid: `host${i}`, startAt: now, endAt: now + 3600000 }],
      members: [],
      rateLimits,
    });
    outcomes.push(await ctx.joinTeam({ teamId: `t${i}` }, 'u'));
  }
  assert.equal(outcomes.slice(0, limit).every((r) => r.ok), true);
  assert.equal(outcomes[limit].ok, false);
  assert.match(outcomes[limit].errMsg, /频繁/);
});

test('bug reports are stored, validated and limited', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const reports = [];
  const ctx = backend({ users, reports });
  assert.equal((await ctx.submitBug({ page: '大厅', content: '【我做了什么】\n\n【出现了什么】\n' }, 'u')).ok, false);
  assert.equal((await ctx.submitBug({ page: '', content: '页面点不动' }, 'u')).ok, false);
  const res = await ctx.submitBug({ page: '发车', content: '发车时时间选不了', errorMsg: 'TypeError', version: '0.7.0' }, 'u');
  assert.equal(res.ok, true);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].kind, 'bug');
  assert.equal(reports[0].page, '发车');
  assert.equal(reports[0].status, 'open');
  // 3 条/5 分钟：前三次通过，第四次被拦。
  assert.equal((await ctx.submitBug({ page: '发车', content: '还有一个小问题' }, 'u')).ok, true);
  assert.equal((await ctx.submitBug({ page: '发车', content: '再来一条补充说明' }, 'u')).ok, true);
  const blocked = await ctx.submitBug({ page: '发车', content: '这条应该被限流拦下' }, 'u');
  assert.equal(blocked.ok, false);
  assert.match(blocked.errMsg, /稍后/);
});

test('reports require a real target, a valid reason and reject duplicates', async () => {
  const reports = [];
  const teams = [{ _id: 't', gameName: 'CS2', openid: 'host', status: 'recruiting', startAt: Date.now(), endAt: Date.now() + 3600000 }];
  const ctx = backend({ reports, teams });
  assert.equal((await ctx.submitReport({ targetType: 'team', targetId: 't', reason: '乱写' }, 'u')).ok, false);
  assert.equal((await ctx.submitReport({ targetType: 'team', targetId: 'missing', reason: '广告营销' }, 'u')).ok, false);
  const first = await ctx.submitReport({ targetType: 'team', targetId: 't', reason: '广告营销', content: '在群里发广告' }, 'u');
  assert.equal(first.ok, true);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].targetName, 'CS2');
  assert.equal(reports[0].hostOpenid, 'host');
  const dup = await ctx.submitReport({ targetType: 'team', targetId: 't', reason: '广告营销' }, 'u');
  assert.equal(dup.ok, false);
  assert.match(dup.errMsg, /举报过/);
  assert.equal(reports.length, 1);
});

test('admin endpoints are gated and expose aggregated stats', async () => {
  const now = Date.now();
  const teams = [
    { _id: 't1', gameName: 'CS2', platform: 'Steam', status: 'recruiting', memberCount: 2, capacity: 5, startAt: now, endAt: now + 3600000, createdAt: now },
    { _id: 't2', gameName: 'CS2', platform: 'Steam', status: 'full', memberCount: 5, capacity: 5, startAt: now, endAt: now + 3600000, createdAt: now },
    { _id: 't3', gameName: '永劫无间', platform: '端游', status: 'cancelled', memberCount: 1, capacity: 5, startAt: now, endAt: now + 3600000, createdAt: now },
  ];
  const reports = [
    { _id: 'r1', kind: 'report', status: 'open', createdAt: now },
    { _id: 'r2', kind: 'bug', status: 'handled', createdAt: now },
  ];
  const ctx = backend({ teams, reports, users: [{ _id: 'a', nickName: 'A' }] });

  assert.equal((await ctx.adminOverview('nobody')).ok, false);

  const adminCtx = backend({ teams, reports, users: [{ _id: 'a', nickName: 'A' }], env: { ADMIN_OPENIDS: 'a, b' } });
  const res = await adminCtx.adminOverview('a');
  assert.equal(res.ok, true);
  assert.equal(res.stats.teams.total, 3);
  assert.equal(res.stats.teams.active, 2);
  assert.equal(res.stats.teams.recruiting, 1);
  assert.equal(res.stats.reports.open, 1);
  assert.equal(res.stats.reports.bug, 1);
  assert.equal(res.stats.topGames[0].gameName, 'CS2');
  assert.equal(res.stats.topGames[0].teams, 2);
  assert.equal(res.stats.trend.length, 7);
  assert.equal(res.stats.platforms.find((p) => p.platform === 'Steam').count, 2);

  const bugs = await adminCtx.adminReports({ kind: 'bug' }, 'a');
  assert.equal(bugs.list.length, 1);
  assert.equal(bugs.list[0]._id, 'r2');
  const openOnly = await adminCtx.adminReports({ status: 'open' }, 'a');
  assert.equal(openOnly.list.length, 1);
  assert.equal(openOnly.list[0]._id, 'r1');

  await adminCtx.adminHandleReport({ reportId: 'r1', status: 'handled' }, 'a');
  assert.equal(reports.find((r) => r._id === 'r1').status, 'handled');
  assert.equal((await adminCtx.adminHandleReport({ reportId: 'missing' }, 'a')).ok, false);
});

test('admin can be granted through the admins collection too', async () => {
  const ctx = backend({ admins: [{ _id: 'boss' }], teams: [], reports: [] });
  assert.equal((await ctx.adminOverview('boss')).ok, true);
  assert.equal((await ctx.adminReports({}, 'not-boss')).ok, false);
});

test('admin team list returns ongoing teams and force-close cancels a team', async () => {
  const now = Date.now();
  const teams = [
    { _id: 'live', gameName: 'CS2', hostNickName: '车头A', memberCount: 2, capacity: 5, status: 'recruiting', openid: 'h1', startAt: now + 60000, endAt: now + 3600000 },
    { _id: 'dead', gameName: 'CS2', status: 'cancelled', memberCount: 1, capacity: 5, openid: 'h2', startAt: now, endAt: now + 3600000 },
    { _id: 'gone', gameName: 'CS2', status: 'recruiting', memberCount: 1, capacity: 5, openid: 'h3', startAt: now - 7200000, endAt: now - 3600000 },
  ];
  const members = [
    { _id: 'm1', teamId: 'live', openid: 'h1', role: 'host' },
    { _id: 'm2', teamId: 'live', openid: 'guest', role: 'member' },
  ];
  const sends = [];
  const ctx = backend({ teams, members, env: { ADMIN_OPENIDS: 'admin' }, send: async ({ touser }) => { sends.push(touser); } });

  const list = await ctx.adminTeams({}, 'admin');
  assert.deepEqual(list.list.map((t) => t._id), ['live']);
  assert.equal((await ctx.adminTeams({}, 'nobody')).ok, false);

  const res = await ctx.adminCancelTeam({ teamId: 'live' }, 'admin');
  assert.equal(res.ok, true);
  assert.equal(teams.find((t) => t._id === 'live').status, 'cancelled');
  assert.equal(teams.find((t) => t._id === 'live').cancelledBy, 'admin');
  // 管理端关闭会通知车上所有人（含车头）。
  assert.deepEqual([...sends].sort(), ['guest', 'h1']);
  assert.equal((await ctx.adminCancelTeam({ teamId: 'live' }, 'admin')).ok, false);
  assert.equal((await ctx.adminCancelTeam({ teamId: 'gone' }, 'admin')).ok, false);
});

test('force-closing is admin-only and never bypasses the host on cancelTeam', async () => {
  const now = Date.now();
  const teams = [{ _id: 't', gameName: 'CS2', status: 'recruiting', memberCount: 1, capacity: 5, openid: 'host', startAt: now, endAt: now + 3600000 }];
  const ctx = backend({ teams, env: { ADMIN_OPENIDS: 'admin' } });
  // 非管理员不能强制关闭。
  assert.equal((await ctx.adminCancelTeam({ teamId: 't' }, 'host')).ok, false);
  // 普通 cancelTeam 仍只允许车头。
  assert.equal((await ctx.cancelTeam({ teamId: 't' }, 'guest')).ok, false);
  assert.equal(ctx.hostUid(teams[0]), 'host');
});

test('getProfile reports admin status for the current user', async () => {
  const users = [{ _id: 'a', _openid: 'a', nickName: 'A' }];
  const plain = backend({ users });
  assert.equal((await plain.getProfile('a')).isAdmin, false);
  const admin = backend({ users, env: { ADMIN_OPENIDS: 'a' } });
  assert.equal((await admin.getProfile('a')).isAdmin, true);
});

test('admin can ban and unban a user, with guards for self and admins', async () => {
  const users = [{ _id: 'trouble', openid: 'trouble', nickName: '捣乱的' }];
  const ctx = backend({ users, env: { ADMIN_OPENIDS: 'admin, boss' } });

  // 非管理员不能操作。
  assert.equal((await ctx.adminSetBan({ userId: 'trouble', banned: true }, 'stranger')).ok, false);
  // 不能封禁自己，也不能封禁管理员。
  assert.equal((await ctx.adminSetBan({ userId: 'admin', banned: true }, 'admin')).ok, false);
  assert.equal((await ctx.adminSetBan({ userId: 'boss', banned: true }, 'admin')).ok, false);
  // 目标不存在（用一个空用户表的上下文验证）。
  const empty = backend({ users: [], env: { ADMIN_OPENIDS: 'admin' } });
  assert.equal((await empty.adminSetBan({ userId: 'ghost', banned: true }, 'admin')).ok, false);

  const banned = await ctx.adminSetBan({ userId: 'trouble', banned: true, reason: '刷广告' }, 'admin');
  assert.equal(banned.ok, true);
  assert.equal(users[0].banned, true);
  assert.equal(users[0].banReason, '刷广告');
  assert.ok(users[0].bannedAt);

  await ctx.adminSetBan({ userId: 'trouble', banned: false }, 'admin');
  assert.equal(users[0].banned, false);
  assert.equal(users[0].banReason, '');
});

test('a banned account cannot write but can still browse', async () => {
  const now = Date.now();
  const users = [{ _id: 'bad', openid: 'bad', nickName: '违规用户', banned: true }];
  const teams = [{ _id: 't', gameName: 'CS2', capacity: 5, memberCount: 1, status: 'recruiting', openid: 'host', startAt: now, endAt: now + 3600000 }];
  const members = [{ _id: 'm1', teamId: 't', openid: 'host', role: 'host' }];
  const ctx = backend({ users, teams, members });
  await assert.rejects(() => ctx.requireProfile('bad'), (e) => e.code === 'BANNED');
  await assert.rejects(() => ctx.saveProfile({ nickName: '改名' }, 'bad'), (e) => e.code === 'BANNED');
  await assert.rejects(() => ctx.submitFeedback({ kind: '其他', page: '我的', content: '随便说说' }, 'bad'), (e) => e.code === 'BANNED');
  await assert.rejects(() => ctx.submitBug({ page: '大厅', content: '页面点不动' }, 'bad'), (e) => e.code === 'BANNED');
  await assert.rejects(() => ctx.submitReport({ targetType: 'team', targetId: 't', reason: '广告营销' }, 'bad'), (e) => e.code === 'BANNED');
  // 浏览接口不受影响。
  assert.equal((await ctx.getTeam({ teamId: 't' }, 'bad')).ok, true);
  assert.equal((await ctx.listTeams({}, 'bad')).ok, true);
});

test('admin user list aggregates activity and supports filters', async () => {
  const now = Date.now();
  const users = [
    { _id: 'u1', openid: 'u1', nickName: '小明', banned: false, updatedAt: now },
    { _id: 'u2', openid: 'u2', nickName: '广告号', banned: true, banReason: '刷广告', updatedAt: now - 1000 },
  ];
  const teams = [{ _id: 't1', gameName: 'CS2', status: 'recruiting', memberCount: 2, capacity: 5, openid: 'u1', startAt: now, endAt: now + 3600000 }];
  const members = [
    { _id: 'm1', teamId: 't1', openid: 'u1', role: 'host' },
    { _id: 'm2', teamId: 't1', openid: 'u2', role: 'member' },
  ];
  const ctx = backend({ users, teams, members, env: { ADMIN_OPENIDS: 'admin' } });

  assert.equal((await ctx.adminUsers({}, 'nobody')).ok, false);
  const all = await ctx.adminUsers({}, 'admin');
  assert.equal(all.total, 2);
  assert.equal(all.list.find((u) => u._id === 'u1').hosted, 1);
  assert.equal(all.list.find((u) => u._id === 'u2').joined, 1);
  // 已封禁的排前面。
  assert.equal(all.list[0]._id, 'u2');
  const banned = await ctx.adminUsers({ bannedOnly: true }, 'admin');
  assert.deepEqual(banned.list.map((u) => u._id), ['u2']);
  const searched = await ctx.adminUsers({ keyword: '广告' }, 'admin');
  assert.deepEqual(searched.list.map((u) => u._id), ['u2']);
});

test('myTeams never returns teams that merely share a partial identity', async () => {
  const ctx = backend({
    members: [
      { _id: 'mine', teamId: 'a', openid: 'me', role: 'member' },
      { _id: 'theirs', teamId: 'b', _openid: 'someone-else', role: 'member' },
    ],
    teams: [
      { _id: 'a', gameName: 'CS2', status: 'recruiting', memberCount: 2, capacity: 5, openid: 'h1', startAt: Date.now(), endAt: Date.now() + 3600000 },
      { _id: 'b', gameName: 'DOTA', status: 'recruiting', memberCount: 2, capacity: 5, openid: 'h2', startAt: Date.now(), endAt: Date.now() + 3600000 },
    ],
  });
  const res = await ctx.myTeams('me');
  assert.equal(res.joined.length, 1);
  assert.equal(res.joined[0]._id, 'a');
  assert.equal(res.hosted.length, 0);
});
