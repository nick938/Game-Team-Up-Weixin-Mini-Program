const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function backend({ teams = [], members = [], users = [], feedback = [], send = async () => {}, env = {}, sendMail, imgCheck, msgCheck } = {}) {
  const tables = { teams, members, users, feedback };
  const deleted = [];
  const db = {
    command: { gte: () => ({ and: () => ({}) }), lte: () => ({}) },
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
      : name.endsWith('/version') ? { getAppVersion: () => ({ text: 'v0.6.0' }) } : {},
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

test('app version falls back to local build and labels env', () => {
  let info = { envVersion: 'develop', version: '' };
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/utils/version.js'), 'utf8'), {
    require: () => ({ APP_VERSION: '0.6.0' }),
    module: mod,
    wx: { getAccountInfoSync: () => ({ miniProgram: info }) },
  });
  assert.equal(mod.exports.getAppVersion().text, 'v0.6.0 · 开发版');
  info = { envVersion: 'release', version: '1.2.0' };
  assert.equal(mod.exports.getAppVersion().text, 'v1.2.0');
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
