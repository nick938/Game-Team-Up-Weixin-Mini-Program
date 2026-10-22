const { harness } = require('./support/miniapp.cjs');
const loadUtility = name => harness().load('utils/' + name);
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function backend({ teams = [], members = [], users = [], feedback = [], reports = [], rateLimits = [], admins = [], organizers = [], send = async () => {}, env = {}, sendMail, imgCheck, msgCheck, paginate = false, beforeTransaction } = {}) {
  const tables = { teams, members, users, feedback, reports, rate_limits: rateLimits, admins, organizers };
  const deleted = [];
  const db = {
    command: { gt: () => ({}), exists: () => ({}), or: () => ({}), gte: () => ({ and: () => ({}) }), lte: () => ({}), in: () => ({}) },
    collection(name) {
      const rows = tables[name] || (tables[name] = []);
      // 默认忽略 skip/limit（老测试依赖全量返回）；paginate 时按真实数据库语义切片。
      let _skip = 0, _limit = Infinity;
      return {
        where() { return this; }, orderBy() { return this; },
        limit(n) { _limit = n; return this; },
        skip(n) { _skip = n; return this; },
        async get() { return { data: paginate ? rows.slice(_skip, _skip + _limit) : rows }; },
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
    async runTransaction(fn) {
      if (beforeTransaction) beforeTransaction();
      // 官方限制：事务内只支持单记录操作（collection.doc / collection.add），
      // where 等批量操作会报错。事务包装成只暴露 doc 和 add，防止代码退回旧写法。
      const self = this;
      const tx = {
        collection(name) {
          const ref = self.collection(name);
          return {
            doc: (id) => ref.doc(id),
            add: (args) => ref.add(args),
            where() { throw new Error("事务中不支持 where 批量操作"); },
            get() { throw new Error("事务中不支持批量读取"); },
          };
        },
      };
      return fn(tx);
    },
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
      if (id === "node:crypto") return require(id);
      if (id === "./lib/profile-options.json") return require("../cloudfunctions/team/lib/profile-options.json");
      if (id === "./lib/user-rankings") return require("../cloudfunctions/team/lib/user-rankings");
      if (id === "./lib/daily-play") return require("../cloudfunctions/team/lib/daily-play");
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

test('share cover is a package-local 5:4 JPEG so cards never fall back to a page screenshot', () => {
  const { SHARE_COVER } = loadUtility('share');
  // 微信只接受包内相对路径和网络地址；写成绝对路径或漏掉前导斜杠会静默退回自动截图。
  assert.match(SHARE_COVER, /^\/static\/images\/[A-Za-z0-9._/-]+\.jpg$/);

  const file = path.join(root, 'apps/miniapp/src', SHARE_COVER);
  assert.ok(fs.existsSync(file), `${SHARE_COVER} 不存在，卡片会退回页面截图`);
  const buf = fs.readFileSync(file);
  assert.equal(buf.readUInt16BE(0), 0xffd8, '封面不是 JPEG');

  // 微信推荐 5:4，这里直接读 SOF 段校验，省掉图片库依赖。
  let offset = 2;
  let size = null;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) { offset += 1; continue; }
    const marker = buf[offset + 1];
    // 无长度字段的独立标记
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      size = { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      break;
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  assert.ok(size, '读不出 JPEG 尺寸');
  assert.equal(size.width / size.height, 5 / 4);
});

test('team share cover content mirrors the detail page hero card', () => {
  const { coverContent, WIDTH, HEIGHT } = loadUtility('team-cover');
  assert.equal(WIDTH / HEIGHT, 5 / 4);

  const startAt = new Date(Date.now() + 86400000).setHours(21, 0, 0, 0);
  const live = { memberCount: 5, capacity: 12, startAt, endAt: startAt + 7200000 };
  const recruiting = coverContent({
    gameName: '房车（我们到了吗？）',
    displayStatus: 'recruiting',
    needCount: 7,
    memberCount: 5,
    capacity: 12,
    ...live,
    platform: 'Steam',
    server: '亚服',
    voice: '不限',
    rankReq: '',
  });
  assert.equal(recruiting.gameName, '房车（我们到了吗？）');
  assert.equal(recruiting.statusText, '缺人');
  assert.equal(recruiting.needText, '还差 7 人');
  assert.equal(recruiting.countText, '5/12');
  assert.match(recruiting.timeText, /21:00/);
  // 平台标签不展示；「不限」和空值不占位置
  assert.deepEqual(recruiting.tags, ['亚服']);

  assert.equal(coverContent(null), null);
  // 满员后不再显示「还差 N 人」，否则分享出去人数是矛盾的
  const full = coverContent({ ...live, displayStatus: 'full', memberCount: 12 });
  assert.equal(full.statusText, '满员');
  assert.equal(full.needText, '');
  assert.equal(coverContent({ ...live, displayStatus: 'cancelled' }).statusText, '已散');
  assert.equal(coverContent({ ...live, displayStatus: 'expired' }).statusText, '已结束');
  // 缺 capacity 时退化成纯人数；缺游戏名也要有东西可画
  assert.equal(coverContent({ memberCount: 3 }).countText, '3 人');
  assert.equal(coverContent({}).gameName, '开黑');
  assert.equal(coverContent({}).statusText, '状态待确认');
  const stale = coverContent({ ...live, startAt: Date.now() - 7200000, endAt: Date.now() - 1, displayStatus: 'recruiting' });
  assert.equal(stale.statusText, '已结束');
  assert.equal(stale.needText, '');
});

test('team share cover wraps long game names and clamps to two lines', () => {
  const { wrapText } = loadUtility('team-cover');
  // 汉字算 10、拉丁字母算 5，所以 maxWidth=100 刚好放下 10 个汉字
  const ctx = {
    measureText(text) {
      let width = 0;
      for (const ch of String(text)) {
        width += /[A-Za-z0-9'’\-.]/.test(ch) ? 5 : 10;
      }
      return { width };
    },
  };

  assert.deepEqual(wrapText(ctx, '房车来了', 100, 2), ['房车来了']);
  assert.deepEqual(wrapText(ctx, '', 100, 2), []);

  // 折两行要配平。贪心填充会断成「一二三四五六七八九十」+「甲乙丙」，第二行只剩三个字
  assert.deepEqual(wrapText(ctx, '一二三四五六七八九十甲乙丙', 100, 2), ['一二三四五六', '七八九十甲乙丙']);

  const clamped = wrapText(ctx, '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅卯', 100, 2);
  assert.equal(clamped.length, 2);
  assert.ok(clamped[1].endsWith('…'), `超出行数要省略号收尾，实际 ${clamped[1]}`);
  assert.ok(ctx.measureText(clamped[1]).width <= 100, '省略后仍不能超宽');

  // 拉丁词不能从中间劈开
  assert.deepEqual(wrapText(ctx, 'Counter-Strike 2 开黑', 60, 2), ['Counter-Strike', '2 开黑']);

  // 真机上的实际问题：封面用 36px 字号，10 个字的车名折行后第二行只剩一个「）」
  const real = {
    measureText(text) {
      let width = 0;
      for (const ch of String(text)) {
        width += /[A-Za-z0-9'’\-.]/.test(ch) ? 18 : 36;
      }
      return { width };
    },
  };
  const inner = 375 - 48;
  assert.deepEqual(wrapText(real, '房车（我们到了吗？）', inner, 2), ['房车（我们', '到了吗？）']);
  assert.deepEqual(wrapText(real, '永劫无间手游双排冲分', inner, 2), ['永劫无间手', '游双排冲分']);
  // 短名字仍然单行，别为了配平硬折
  assert.deepEqual(wrapText(real, '地平线 5', inner, 2), ['地平线 5']);
  assert.deepEqual(wrapText(real, '三角洲行动', inner, 2), ['三角洲行动']);
});

test('decorateTeam keeps shareable team fields and coerces null mark to empty string', () => {
  const { decorateTeam } = loadUtility('format');
  assert.equal(decorateTeam({ gameName: '以撒', mark: null }).mark, '');
  assert.equal(decorateTeam({ gameName: '以撒' }).mark, '');
  assert.equal(decorateTeam({ gameName: '以撒', mark: '我发的' }).mark, '我发的');
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

test('public profile saves the signature, preserves it when omitted and allows clearing', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({ users });
  assert.equal((await ctx.saveProfile({ nickName: '玩家', bio: ' Steam 001234，晚上在线 ' }, 'u')).ok, true);
  assert.equal(users[0].bio, 'Steam 001234，晚上在线');
  await ctx.saveProfile({ nickName: '新昵称' }, 'u');
  assert.equal(users[0].bio, 'Steam 001234，晚上在线');
  await ctx.saveProfile({ nickName: '新昵称', bio: '' }, 'u');
  assert.equal(users[0].bio, '');
});

test('invalid signature fails before changing account data', async () => {
  const users = [{ _id: 'u', nickName: '原昵称' }];
  const ctx = backend({ users });
  for (const bio of [123, 'x'.repeat(51)]) {
    assert.equal((await ctx.saveProfile({ nickName: '新昵称', bio }, 'u')).ok, false);
    assert.equal(users[0].nickName, '原昵称');
    assert.equal(users[0].bio, undefined);
  }
  // 50 字刚好通过。
  assert.equal((await ctx.saveProfile({ nickName: '新昵称', bio: 'x'.repeat(50) }, 'u')).ok, true);
  assert.equal(users[0].bio.length, 50);
});

test('room profile returns only nickName/avatar/bio and rejects unrelated members', async () => {
  const users = [{ _id: 'u', _openid: 'secret', nickName: '最新昵称', bio: 'Steam 00123', notifyEnabled: false, privateField: 'secret' }];
  const ctx = backend({ teams: [{ _id: 't', gameName: 'CS2' }], members: [{ _id: 'm', teamId: 't', openid: 'u', nickName: '旧昵称' }, { _id: 'other', teamId: 'another', openid: 'u' }], users });
  const result = await ctx.getPublicProfile({ teamId: 't', memberId: 'm' });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.profile).sort(), ['avatarUrl', 'avatarFileID', 'avatarBase64', 'bio', 'nickName', 'groupIds', 'favoriteGames', 'playTimes', 'steamFriendCode', 'wechatId'].sort());
  assert.equal(result.profile.nickName, '最新昵称');
  assert.equal(result.profile.bio, 'Steam 00123');
  assert.equal(result.profile.privateField, undefined);
  assert.equal(result.profile._openid, undefined);
  users[0].bio = '';
  assert.equal((await ctx.getPublicProfile({ teamId: 't', memberId: 'm' })).profile.bio, '');
  assert.equal((await ctx.getPublicProfile({ teamId: 't', memberId: 'other' })).ok, false);
  assert.equal((await ctx.getPublicProfile({ teamId: 't', memberId: 'missing' })).ok, false);
});

test('team duration cannot exceed 24 hours and allows exactly 24 hours', () => {
  const ctx = backend();
  const startAt = Date.now() + 60 * 1000;
  const tooLong = ctx.validateTeamInput({
    gameName: 'CS2',
    roomNo: '123456',
    capacity: 5,
    startAt,
    endAt: startAt + 24 * 60 * 60 * 1000 + 1,
    platform: 'Steam',
    voice: 'KOOK',
  }, { isCreate: true });
  assert.equal(tooLong.error, '一局最长 24 小时');
  const ok = ctx.validateTeamInput({
    gameName: 'CS2',
    roomNo: '123456',
    capacity: 5,
    startAt,
    endAt: startAt + 24 * 60 * 60 * 1000,
    platform: 'Steam',
    voice: 'KOOK',
  }, { isCreate: true });
  assert.equal(ok.error, undefined);
  assert.equal(ok.value.endAt - ok.value.startAt, 24 * 60 * 60 * 1000);
});

test('team note supports up to 1000 characters and clamps beyond', () => {
  const ctx = backend();
  const startAt = Date.now() + 60 * 1000;
  const longNote = '车'.repeat(1050);
  const validated = ctx.validateTeamInput({
    gameName: 'CS2',
    roomNo: '123456',
    capacity: 5,
    startAt,
    endAt: startAt + 3600 * 1000,
    platform: 'Steam',
    voice: 'KOOK',
    note: longNote,
  }, { isCreate: true });
  assert.equal(validated.error, undefined);
  assert.equal(validated.value.note, '车'.repeat(1000));
  const edited = ctx.validateTeamInput({ ...validated.value, note: '玩'.repeat(1000) }, { isCreate: false });
  assert.equal(edited.error, undefined);
  assert.equal(edited.value.note, '玩'.repeat(1000));
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

test('feedback is rate limited like the other write endpoints', async () => {
  const ctx = backend({
    feedback: [],
    rateLimits: [{
      _id: 'submitFeedback_u',
      openid: 'u',
      action: 'submitFeedback',
      hits: Array(5).fill(Date.now()),
    }],
  });
  const blocked = await ctx.submitFeedback({
    kind: '其他', page: '我的', content: '写下具体的反馈内容',
  }, 'u');
  assert.equal(blocked.ok, false);
  assert.match(blocked.errMsg, /反馈太频繁/);
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
  const res = await ctx.listTeams({}, '');
  assert.equal(res.list.length, 2);
  // 已开始的车仍会返回（带 started 标记），排序交给客户端。
  assert.deepEqual([...res.list.map((t) => t._id)].sort(), ['started', 'upcoming']);
  assert.equal(res.hasMore, false);
  // 已取消 / 已过期不算「进行中」。
  assert.equal(ctx.stripSecret({ ...startedTeam, status: 'cancelled' }, false).started, false);
  assert.equal(ctx.stripSecret({ ...startedTeam, endAt: now - 1 }, false).started, false);
});

test('lobby paginates by createdAt desc and reports hasMore/nextOffset', async () => {
  const now = Date.now();
  const live = (n, at) => ({ _id: `live${n}`, gameName: 'CS2', capacity: 5, memberCount: 2, status: 'recruiting', endAt: now + 3600000, createdAt: at });
  // 库内按 createdAt 倒序返回（真实库由 orderBy 保证，这里按该顺序铺数据）。
  const teams = [live(3, 300), live(2, 200), live(1, 100)];
  const ctx = backend({ teams, paginate: true });
  // 每页 2 条：第一页拿 2 条且还有更多，nextOffset 精确指向第二条之后。
  const first = await ctx.listTeams({ offset: 0, limit: 2 }, '');
  assert.deepEqual([...first.list.map(t => t._id)], ['live3', 'live2']);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextOffset, 2);
  // 第二页拿剩下的 1 条，到底。
  const second = await ctx.listTeams({ offset: first.nextOffset, limit: 2 }, '');
  assert.deepEqual([...second.list.map(t => t._id)], ['live1']);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextOffset, 3);
  // 越界返回空页且不再 hasMore。
  const beyond = await ctx.listTeams({ offset: 99, limit: 2 }, '');
  assert.equal(beyond.list.length, 0);
  assert.equal(beyond.hasMore, false);
  // 已取消 / 已过期的车被跳过，不会占分页名额；扫描时也不误判到底。
  const mixed = [live(3, 300), { ...live(9, 250), status: 'cancelled' }, live(2, 200), { ...live(8, 150), endAt: now - 1 }, live(1, 100)];
  const ctx2 = backend({ teams: mixed, paginate: true });
  const page = await ctx2.listTeams({ offset: 0, limit: 2 }, '');
  assert.deepEqual([...page.list.map(t => t._id)], ['live3', 'live2']);
  assert.equal(page.hasMore, true);
  // offset counts filtered results, not discarded raw database rows.
  assert.equal(page.nextOffset, 2);
  const rest = await ctx2.listTeams({ offset: page.nextOffset, limit: 5 }, '');
  assert.deepEqual([...rest.list.map(t => t._id)], ['live1']);
  assert.equal(rest.hasMore, false);
  // 上限会被夹紧到 50，避免客户端拉过量。
  const capped = await backend({ teams: Array.from({ length: 80 }, (_, i) => live(i, 1000 - i)), paginate: true })
    .listTeams({ offset: 0, limit: 5000 }, '');
  assert.equal(capped.list.length, 50);
  assert.equal(capped.hasMore, true);
});

test('lobby sorts by creation or heat, defaulting to newest first', () => {
  const { SORT_MODES, sortTeams } = loadUtility('lobby');
  const ids = list => list.map(t => t._id);
  const now = Date.now();
  const teams = [
    { _id: 'old', createdAt: now - 300000, memberCount: 5, capacity: 5, startAt: now + 60000, started: false },
    { _id: 'new', createdAt: now - 1000, memberCount: 2, capacity: 5, startAt: now + 120000, started: false },
    { _id: 'mid', createdAt: now - 120000, memberCount: 4, capacity: 5, startAt: now - 60000, started: true },
  ];
  // 默认也没有模式时，都按创建时间倒序，最新的在最上面。
  assert.equal(sortTeams(teams)[0]._id, 'new');
  assert.deepEqual(ids(sortTeams(teams, 'latest')), ['new', 'mid', 'old']);
  assert.equal(sortTeams(teams, 'not-a-mode')[0]._id, 'new');
  // 浏览和互动决定热度，同热度再按最新创建；上车人数不参与。
  const tie = [
    { _id: 'a', createdAt: now - 1000, memberCount: 3, viewCount: 3 },
    { _id: 'b', createdAt: now - 90000, memberCount: 5, viewCount: 3 },
    { _id: 'c', createdAt: now - 5000, memberCount: 1, reactions: { counts: { like: 2 } } },
  ];
  assert.deepEqual(ids(sortTeams(tie, 'hot')), ['c', 'a', 'b']);
  // 目前只提供最新 / 最热两档。
  assert.deepEqual(SORT_MODES.map(m => m.key), ['latest', 'hot']);
  // 不改动入参数组本身。
  const input = teams.slice();
  sortTeams(input, 'hot');
  assert.deepEqual(ids(input), ids(teams));
});

test('lobby search matches game, server, rank and note, and composes with filters', () => {
  const { matchKeyword, buildLobbyView } = loadUtility('lobby');
  const teams = [
    { _id: 'a', gameName: 'CS2', server: '国服', rankReq: '上分', note: '萌新友好', createdAt: 300 },
    { _id: 'b', gameName: '永劫无间', server: '亚服', rankReq: '', note: '', createdAt: 200 },
    { _id: 'c', gameName: 'CS2', server: '欧服', rankReq: '娱乐', note: '', createdAt: 100 },
  ];
  // 空关键词全通过。
  assert.equal(matchKeyword(teams[0], ''), true);
  assert.equal(matchKeyword(teams[0], '   '), true);
  // 命中游戏名 / 区服 / 段位 / 备注任意字段即可，大小写与空白不敏感。
  assert.equal(matchKeyword(teams[0], 'cs2'), true);
  assert.equal(matchKeyword(teams[1], 'CS2'), false);
  assert.equal(matchKeyword(teams[1], '亚服'), true);
  assert.equal(matchKeyword(teams[2], '娱乐'), true);
  assert.equal(matchKeyword(teams[0], '萌新'), true);
  assert.equal(matchKeyword(teams[1], '不存在'), false);
  // 搜索 + 游戏筛选 + 排序叠加：先搜「服」→ 三条都中，再筛 CS2 → a、c，再按最新在前 → a、c。
  assert.deepEqual(buildLobbyView(teams, { keyword: '服', gameFilter: 'CS2', sortMode: 'latest' }).map(t => t._id), ['a', 'c']);
  // 只搜索不筛选，默认仍按创建时间排序。
  assert.deepEqual(buildLobbyView(teams, { keyword: 'CS2' }).map(t => t._id), ['a', 'c']);
  assert.deepEqual(buildLobbyView(teams, { keyword: '不存在' }), []);
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

test('saving and reading an avatar returns display URL without persisting it over fileID', async () => {
  const users = [{ _id: 'u', nickName: '玩家', avatarUrl: 'cloud://env/old.png' }];
  const ctx = backend({ users });
  const saved = await ctx.saveProfile({ nickName: '玩家', avatarUrl: 'cloud://env/new.png' }, 'u');
  assert.equal(saved.user.avatarFileID, 'cloud://env/new.png');
  assert.equal(saved.user.avatarUrl, 'https://tmp.example/cloud://env/new.png');
  const profile = await ctx.getProfile('u');
  assert.equal(profile.user.avatarUrl, saved.user.avatarUrl);
  assert.equal(profile.user.avatarFileID, 'cloud://env/new.png');
  assert.equal(users[0].avatarUrl, 'cloud://env/new.png');
  assert.equal(users[0].avatarFileID, undefined);
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
      gameName: '违规内容', roomNo: '123456', capacity: 5,
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
    team: { gameName: 'CS2', roomNo: '123456', capacity: 5, startAt: Date.now() + 60000, endAt: Date.now() + 3600000 },
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
    team: { gameName: 'CS2', roomNo: '123456', capacity: 5, startAt: Date.now() + 60000, endAt: Date.now() + 3600000 },
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
    team: { gameName: 'CS2', roomNo: '123456', capacity: 5, startAt: Date.now() + 60000, endAt: Date.now() + 3600000 },
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
    { _id: 'r1', kind: 'report', status: 'open', createdAt: now, openid: 'u1', hostOpenid: 'h', nickName: '' },
    { _id: 'r2', kind: 'bug', status: 'handled', createdAt: now },
  ];
  const ctx = backend({ teams, reports, users: [{ _id: 'a', nickName: 'A' }] });

  assert.equal((await ctx.adminOverview('nobody')).ok, false);

  const adminCtx = backend({ teams, reports, users: [{ _id: 'a', nickName: 'A' }, { _id: 'h', nickName: '车头' }, { _id: 'u1', nickName: '举报人' }], env: { ADMIN_OPENIDS: 'a, b' } });
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
  // 管理端用昵称指人：车头与提交人都换算成 users 集合里的最新昵称。
  assert.equal(openOnly.list[0].hostNickName, '车头');
  assert.equal(openOnly.list[0].nickName, '举报人');

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
  assert.equal((await plain.getProfile('a')).isOrganizer, false);
  const admin = backend({ users, env: { ADMIN_OPENIDS: 'a' } });
  assert.equal((await admin.getProfile('a')).isAdmin, true);
  assert.equal((await admin.getProfile('a')).isOrganizer, false);
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

function teamPayload() {
  return {
    gameName: 'CS2',
    roomNo: '123456',
    capacity: 5,
    startAt: Date.now() + 60000,
    endAt: Date.now() + 3600000,
  };
}

test('organizer can create a team on behalf of a friend, without becoming host', async () => {
  const users = [
    { _id: 'helper', nickName: '群管理' },
    { _id: 'friend', nickName: '小明' },
  ];
  const teams = [];
  const members = [];
  const ctx = backend({
    users,
    teams,
    members,
    organizers: [{ _id: 'helper', nickName: '群管理' }],
  });

  const denied = await ctx.createTeam({ team: teamPayload(), hostOpenid: 'friend' }, 'stranger');
  assert.equal(denied.ok, false);
  assert.match(denied.errMsg, /代开权限/);

  const res = await ctx.createTeam({ team: teamPayload(), hostOpenid: 'friend' }, 'helper');
  assert.equal(res.ok, true);
  assert.equal(teams[0].openid, 'friend');
  assert.equal(teams[0].hostNickName, '小明');
  assert.equal(teams[0].proxyOpenid, 'helper');
  assert.equal(teams[0].proxyNickName, '群管理');
  assert.equal(members[0].openid, 'friend');
  assert.equal(members[0].role, 'host');
  assert.equal(members.length, 1);

  const publicTeam = ctx.stripSecret(teams[0], false);
  assert.equal(publicTeam.proxyOpenid, undefined);
  assert.equal(publicTeam.proxyNickName, '群管理');

  const hosted = await ctx.myTeams('friend');
  assert.equal(hosted.hosted.length, 1);
  const helperTeams = await ctx.myTeams('helper');
  assert.equal(helperTeams.hosted.length, 0);
  assert.equal(helperTeams.joined.length, 0);
});

test('admin can proxy-create without being an organizer, organizers cannot open admin', async () => {
  const users = [
    { _id: 'boss', nickName: '站长' },
    { _id: 'helper', nickName: '群管理' },
    { _id: 'friend', nickName: '小明' },
  ];
  const ctx = backend({
    users,
    organizers: [{ _id: 'helper' }],
    env: { ADMIN_OPENIDS: 'boss' },
  });
  assert.equal((await ctx.adminOverview('helper')).ok, false);
  assert.equal((await ctx.getProfile('helper')).isOrganizer, true);
  assert.equal((await ctx.getProfile('helper')).isAdmin, false);
  const res = await ctx.createTeam({ team: teamPayload(), hostOpenid: 'friend' }, 'boss');
  assert.equal(res.ok, true);
});

test('proxy create is rejected for banned or profile-less friends', async () => {
  const users = [
    { _id: 'helper', nickName: '群管理' },
    { _id: 'banned', nickName: '封禁号', banned: true },
    { _id: 'newbie' },
  ];
  const ctx = backend({ users, organizers: [{ _id: 'helper' }] });
  const banned = await ctx.createTeam({ team: teamPayload(), hostOpenid: 'banned' }, 'helper');
  assert.equal(banned.ok, false);
  assert.match(banned.errMsg, /封禁/);
  const missing = await ctx.createTeam({ team: teamPayload(), hostOpenid: 'newbie' }, 'helper');
  assert.equal(missing.ok, false);
  assert.match(missing.errMsg, /头像昵称/);
});

test('searchProxyUsers is organizer-only and hides banned users', async () => {
  const users = [
    { _id: 'helper', nickName: '群管理' },
    { _id: 'friend', nickName: '小明同学' },
    { _id: 'banned', nickName: '小明广告', banned: true },
  ];
  const ctx = backend({ users, organizers: [{ _id: 'helper' }] });
  assert.equal((await ctx.searchProxyUsers({ keyword: '小明' }, 'stranger')).ok, false);
  const res = await ctx.searchProxyUsers({ keyword: '小明' }, 'helper');
  assert.equal(res.ok, true);
  assert.deepEqual(res.list.map((u) => u.userId), ['friend']);
  assert.equal(res.list[0].nickName, '小明同学');
});

test('admin can grant and revoke organizer, and banning removes it', async () => {
  const users = [{ _id: 'helper', nickName: '群管理' }];
  const organizers = [];
  const ctx = backend({ users, organizers, env: { ADMIN_OPENIDS: 'boss' } });
  assert.equal((await ctx.adminSetOrganizer({ userId: 'helper', enabled: true }, 'stranger')).ok, false);
  const granted = await ctx.adminSetOrganizer({ userId: 'helper', enabled: true }, 'boss');
  assert.equal(granted.ok, true);
  assert.equal((await ctx.getProfile('helper')).isOrganizer, true);
  assert.equal((await ctx.adminUsers({}, 'boss')).list[0].isOrganizer, true);

  await ctx.adminSetBan({ userId: 'helper', banned: true }, 'boss');
  assert.equal((await ctx.getProfile('helper')).isOrganizer, false);
  assert.equal(organizers.length, 0);
});

test('ORGANIZER_OPENIDS env grants proxy access and cannot be toggled in admin', async () => {
  const users = [
    { _id: 'helper', nickName: '群管理' },
    { _id: 'friend', nickName: '小明' },
  ];
  const ctx = backend({ users, env: { ORGANIZER_OPENIDS: 'helper', ADMIN_OPENIDS: 'boss' } });
  assert.equal((await ctx.getProfile('helper')).isOrganizer, true);
  const created = await ctx.createTeam({ team: teamPayload(), hostOpenid: 'friend' }, 'helper');
  assert.equal(created.ok, true);
  const blocked = await ctx.adminSetOrganizer({ userId: 'helper', enabled: false }, 'boss');
  assert.equal(blocked.ok, false);
});

test('cloud accepts empty contact for creating and editing', () => {
  const ctx = backend();
  for (const isCreate of [true, false]) {
    for (const roomNo of [undefined, '', '   ', '\t\n']) {
      assert.equal(ctx.validateTeamInput({ ...teamPayload(), roomNo }, { isCreate }).value.roomNo, '');
    }
    const valid = ctx.validateTeamInput({ ...teamPayload(), roomNo: '  Steam 好友代码 123456  ' }, { isCreate });
    assert.equal(valid.error, undefined);
    assert.equal(valid.value.roomNo, 'Steam 好友代码 123456');
    assert.equal(valid.value.roomPwd, '');
  }
});

test('reaction retries, switches and cancellations maintain one vote per actor, even on ended teams', async () => {
  const team = { _id: 't', gameName: 'CS2', status: 'recruiting', endAt: Date.now() - 1000 };
  const ctx = backend({ teams: [team] });
  const vote = (reaction, actor = 'a') => ctx.setReaction({ teamId: 't', reaction }, actor);
  assert.equal((await vote('like')).reactions.counts.like, 1);
  assert.equal((await vote('like')).reactions.counts.like, 1);
  assert.equal((await vote('like', 'b')).reactions.counts.like, 2);
  const changed = await vote('fire');
  assert.equal(changed.reactions.counts.like, 1);
  assert.equal(changed.reactions.counts.fire, 1);
  assert.equal(changed.reactions.mine, 'fire');
  const cancel = await vote('');
  assert.equal(cancel.reactions.counts.fire, 0);
  assert.equal(cancel.reactions.counts.like, 1);
  assert.equal((await vote('')).reactions.counts.like, 1);
  const summary = await ctx.readReactionSummary('t', 'b');
  assert.equal(summary.mine, 'like');
  assert.deepEqual(Object.keys(summary).sort(), ['counts', 'mine', 'selected']);
  assert.equal(JSON.stringify(summary).includes('openid'), false);
});
test('reaction rejects invalid values, missing teams, banned users and rate limits without changing counts', async () => {
  const team = { _id: 't', gameName: 'CS2', status: 'recruiting' };
  const ctx = backend({ teams: [team] });
  assert.equal((await ctx.setReaction({ teamId: 't', reaction: 'custom' }, 'a')).ok, false);
  assert.equal((await ctx.setReaction({ teamId: 'missing', reaction: 'like' }, 'a')).ok, false);
  const banned = backend({ teams: [team], users: [{ _id: 'bad', banned: true }] });
  await assert.rejects(banned.setReaction({ teamId: 't', reaction: 'like' }, 'bad'), { code: 'BANNED' });
  const limited = backend({ teams: [team], rateLimits: [{ _id: 'setReaction_a', hits: Array(30).fill(Date.now()) }] });
  assert.equal((await limited.setReaction({ teamId: 't', reaction: 'like' }, 'a')).ok, false);
  assert.equal(team.reactionCounts, undefined);
});

test('server search covers later database batches before filtering, sorting and paging', async () => {
  const now = Date.now();
  const teams = Array.from({ length: 240 }, (_, i) => ({
    _id: 'row-' + i, gameName: i >= 220 ? 'CS2' : '王者荣耀', platform: 'Steam',
    server: '国服', voice: 'KOOK', rankReq: '娱乐',
    roomPwd: 'secret', capacity: 5, memberCount: 2, status: 'recruiting',
    startAt: now + 600000, endAt: now + 3600000, createdAt: i,
  }));
  teams[239].memberCount = 5;
  const ctx = backend({ teams, paginate: true });
  const query = { keyword: '娱乐', gameName: 'CS2', availableOnly: true, limit: 3 };
  const first = await ctx.listTeams(query, '');
  assert.equal(first.total, 19);
  assert.deepEqual([...first.list.map(t => t._id)], ['row-238', 'row-237', 'row-236']);
  assert.equal(first.list[0].roomPwd, '');
  assert.equal(first.list[0].mark, undefined, 'anonymous readers never inherit host marks');
  const next = await ctx.listTeams({ ...query, offset: first.nextOffset }, '');
  assert.deepEqual([...next.list.map(t => t._id)], ['row-235', 'row-234', 'row-233']);
  assert.equal(new Set([...first.list, ...next.list].map(t => t._id)).size, 6);
  assert.equal((await ctx.listTeams({ ...query, platform: '手游' }, '')).total, 0);
  assert.equal((await ctx.listTeams({ ...query, keyword: 'does not exist' }, '')).hasMore, false);
});

test('server game aliases, time filters, full teams and global sorting compose', async () => {
  const now = Date.now();
  const base = { ...teamPayload(), platform: 'Steam', memberCount: 2, status: 'recruiting', createdAt: 1 };
  const teams = [
    { ...base, _id: 'a', gameName: 'CS:GO', startAt: now - 1000, endAt: now + 3600000 },
    { ...base, _id: 'b', gameName: 'cs 2', startAt: now + 600000, memberCount: 4, viewCount: 8 },
    { ...base, _id: 'c', gameName: 'CS2', startAt: now + 600000, memberCount: 5, createdAt: 999 },
    { ...base, _id: 'd', gameName: 'CS2', startAt: now + 7200000, endAt: now + 10800000 },
  ];
  const ctx = backend({ teams });
  const query = { gameNames: ['CS2', 'csgo'], availableOnly: true };
  assert.deepEqual([...(await ctx.listTeams({ ...query, time: 'now' }, '')).list.map(t => t._id)], ['a']);
  assert.deepEqual([...(await ctx.listTeams({ ...query, time: 'soon' }, '')).list.map(t => t._id)], ['b']);
  const all = await ctx.listTeams({ ...query, availableOnly: false, sortMode: 'hot' }, '');
  assert.equal(all.total, 4);
  assert.equal(all.list[0]._id, 'b');
  assert.equal(all.list[1]._id, 'c', 'equal heat falls back to creation time even for full teams');
});

test('editing revalidates current member count and cancellation inside its transaction', async () => {
  for (const mutate of [t => { t.memberCount = 5; }, t => { t.status = 'cancelled'; }]) {
    const team = { _id: 't', ...teamPayload(), openid: 'host', memberCount: 2, status: 'recruiting' };
    const ctx = backend({ teams: [team], users: [{ _id: 'host', nickName: '车头' }], beforeTransaction: () => mutate(team) });
    const res = await ctx.updateTeam({ teamId: 't', team: { ...teamPayload(), capacity: 3 } }, 'host');
    assert.equal(res.ok, false);
    assert.equal(team.capacity, 5);
  }
});

test('editing records only changed field names and keeps private values out of the public payload', async () => {
  const team = { _id: 't', ...teamPayload(), openid: 'host', memberCount: 2, status: 'recruiting' };
  const ctx = backend({ teams: [team], users: [{ _id: 'host', nickName: '车头' }] });
  const res = await ctx.updateTeam({ teamId: 't', team: { roomPwd: 'new-secret', server: '欧服' } }, 'host');
  assert.equal(res.ok, true);
  assert.ok(team.detailsChangedAt);
  assert.ok(team.changedFields.includes('server'));
  assert.ok(team.changedFields.includes('roomPwd'));
  assert.equal(ctx.stripSecret(team, false).roomPwd, '');
  assert.equal(ctx.validateTeamInput({ ...teamPayload(), capacity: 2.5 }, { isCreate: true }).error, '人数需在 2–20 之间');
});

test('behavior events deduplicate per user/team/day and admin statistics do not treat copies as attendance', async () => {
  const team = { _id: 't', ...teamPayload(), memberCount: 2, createdAt: Date.now(), status: 'recruiting' };
  const ctx = backend({ teams: [team], env: { ADMIN_OPENIDS: 'admin' } });
  for (const kind of ['share_view', 'copy_room', 'copy_room']) await ctx.trackTeamEvent({ teamId: 't', kind }, 'visitor');
  await ctx.recordTeamEvent('t', 'visitor', 'join');
  const stats = (await ctx.adminOverview('admin')).stats;
  assert.equal(stats.funnel.shareVisitors, 1);
  assert.equal(stats.funnel.shareJoined, 1);
  assert.equal(stats.funnel.roomCopies, 1);
  assert.equal(stats.funnel.withMembers, 1);
  assert.equal(stats.funnel.full, 0);
  assert.equal((await ctx.trackTeamEvent({ teamId: 't', kind: 'fake' }, 'visitor')).ok, false);
  assert.equal((await ctx.adminOverview('visitor')).ok, false);
});




test('team lists return each viewer reaction without leaking identity', async () => {
  const team = { ...teamPayload(), _id: 't', openid: 'host', memberCount: 1, status: 'recruiting' };
  const ctx = backend({ teams: [team], members: [{ _id: 'm', teamId: 't', openid: 'host', role: 'host' }] });
  await ctx.setReaction({ teamId: 't', reaction: 'fire' }, 'visitor');
  const visitor = (await ctx.listTeams({}, 'visitor')).list[0];
  assert.equal(visitor.reactions.mine, 'fire');
  assert.equal(visitor.reactions.counts.fire, 1);
  assert.equal(visitor.openid, undefined);
  assert.equal((await ctx.listTeams({}, 'host')).list[0].reactions.mine, '');
  assert.equal((await ctx.myTeams('host')).hosted[0].reactions.counts.fire, 1);
});

test('retired weekly and manual daily departures cannot create a second activity car', async () => {
  const teams = [], members = [];
  const ctx = backend({ teams, members, users: [{ _id: 'u', nickName: '玩家' }] });
  ctx.getOpenid = async () => 'u';
  assert.equal((await ctx.createTeam({ team: { ...teamPayload(), weeklyId: '2026-10-23' } }, 'u')).ok, false);
  for (const type of ['getWeeklyPlay', 'votePlay', 'launchPlayOption']) {
    const result = await ctx.exports.main({ type });
    assert.equal(result.ok, false);
    assert.match(result.errMsg, /每日16:00/);
  }
  assert.equal(teams.length, 0);
  assert.equal(members.length, 0);
});

test('editing weekly game or start time detaches the team from the activity without cancelling it', async () => {
  const teams=[{_id:'w',...teamPayload(),weeklyId:'2026-10-23',openid:'u',memberCount:1,status:'recruiting'}];
  const ctx=backend({teams,users:[{_id:'u',nickName:'玩家'}]});
  assert.equal((await ctx.updateTeam({teamId:'w',team:{gameName:'DOTA2'}},'u')).ok,true);
  assert.equal(teams[0].weeklyId,'');
  assert.equal(teams[0].status,'recruiting');
});

test('daily cars remain visible in the lobby and personal teams; room info can change while the agreed game/time stays fixed', async () => {
  const teams = [{ _id: 'daily', ...teamPayload(), platform: 'Steam', dailyOptionId: 'choice', openid: 'host', memberCount: 2, status: 'recruiting' }];
  const members = [{ _id: 'host-member', teamId: 'daily', openid: 'host', role: 'host' }, { _id: 'member', teamId: 'daily', openid: 'voter', role: 'member' }];
  const ctx = backend({ teams, members, users: [{ _id: 'host', nickName: '车头' }] });
  assert.equal((await ctx.listTeams({}, 'visitor')).list[0]._id, 'daily');
  assert.equal((await ctx.myTeams('voter')).joined[0]._id, 'daily');
  assert.equal((await ctx.updateTeam({ teamId: 'daily', team: { roomNo: 'Steam 好友加入' } }, 'host')).ok, true);
  assert.equal(teams[0].roomNo, 'Steam 好友加入');
  for (const patch of [{ gameName: '双人成行' }, { startAt: teams[0].startAt + 60000 }, { endAt: teams[0].endAt + 60000 }, { platform: '手游' }]) {
    assert.equal((await ctx.updateTeam({ teamId: 'daily', team: patch }, 'host')).ok, false);
  }
});

test('real timer creates an unowned car; claiming requires full form and then normal passengers can join', async () => {
  const teams = [], members = [];
  const ctx = backend({ teams, members, users: [{ _id: 'a', nickName: 'A' }, { _id: 'b', nickName: 'B' }, { _id: 'blocked', nickName: '封禁', banned: true }] });
  let at = Date.parse('2026-10-20T15:00:00+08:00');
  ctx.nowMs = () => at;
  let actor = 'a';
  ctx.getOpenid = async () => actor;
  const input = { type: 'createPlayOption', gameName: '饥荒联机版', platform: 'Steam', requestId: 'integration-key' };
  const created = await ctx.exports.main(input);
  assert.equal(created.ok, true);
  const optionId = created.board.options[0].id;
  actor = 'blocked';
  assert.equal((await ctx.exports.main({ type: 'votePlayOption', optionId, want: true })).ok, false);
  actor = 'b';
  assert.equal((await ctx.exports.main({ type: 'votePlayOption', optionId, want: true, openid: 'forged-user' })).ok, true);
  assert.equal(teams.length, 0);
  at = Date.parse('2026-10-20T16:00:00+08:00');
  const tick = await ctx.exports.main({ TriggerName: 'startRemind', Type: 'Timer' });
  assert.equal(tick.ok, true);
  const board = (await ctx.exports.main({ type: 'getDailyPlay' })).board;
  assert.equal(teams.length, 1);
  assert.equal(teams[0].openid, undefined);
  assert.equal(teams[0].memberCount, 0);
  assert.equal(members.length, 0);
  assert.equal((await ctx.listTeams({}, 'visitor')).list[0]._id, board.teamId);
  assert.equal((await ctx.joinTeam({ teamId: board.teamId }, 'b')).ok, false);
  const teamInput = { gameName: teams[0].gameName, platform: teams[0].platform, startAt: teams[0].startAt, endAt: teams[0].endAt, capacity: teams[0].capacity, roomNo: '' };
  teamInput.roomNo = '待填写';
  assert.equal((await ctx.createTeam({ claimTeamId: board.teamId, team: teamInput }, 'b')).ok, false);
  teamInput.roomNo = '';
  assert.equal((await ctx.createTeam({ claimTeamId: board.teamId, team: { ...teamInput, gameName: '改名' } }, 'b')).ok, false);
  const claimed = await ctx.createTeam({ claimTeamId: board.teamId, team: teamInput }, 'b');
  assert.equal(claimed.ok, true);
  assert.equal(claimed.teamId, board.teamId);
  assert.equal(teams[0].openid, 'b');
  assert.equal(teams[0].memberCount, 1);
  assert.equal(teams[0].pendingHost, false);
  assert.deepEqual(members.map(m => m.openid), ['b']);
  assert.equal((await ctx.createTeam({ claimTeamId: board.teamId, team: teamInput }, 'b')).ok, true);
  assert.equal(members.length, 1);
  assert.equal((await ctx.createTeam({ claimTeamId: board.teamId, team: teamInput }, 'a')).ok, false);
  assert.equal((await ctx.joinTeam({ teamId: board.teamId }, 'a')).ok, true);
  assert.equal(teams[0].memberCount, 2);
  assert.equal((await ctx.myTeams('b')).hosted[0]._id, board.teamId);
  await ctx.exports.main({ TriggerName: 'startRemind', Type: 'Timer' });
  assert.equal(teams.length, 1);
});

test('custom game names require an explicit security pass; review, risky, malformed and outages never publish', async () => {
  const cases = [
    async () => ({ errCode: 0, result: { suggest: 'review' } }),
    async () => ({ errCode: 0, result: { suggest: 'risky' } }),
    async () => ({ errCode: 0 }),
    async () => { throw new Error('security offline'); },
  ];
  for (const msgCheck of cases) {
    const ctx = backend({ users: [{ _id: 'a', nickName: 'A' }], msgCheck });
    ctx.nowMs = () => Date.parse('2026-10-20T15:00:00+08:00');
    ctx.getOpenid = async () => 'a';
    const result = await ctx.exports.main({ type: 'createPlayOption', gameName: '自定义游戏', platform: 'Steam', requestId: 'secure-key' });
    assert.equal(result.ok, false);
    assert.match(result.errMsg, /安全检测/);
    assert.equal((await ctx.exports.main({ type: 'getDailyPlay' })).board.options.length, 0);
  }
});

test('all four reactions are mutually exclusive, switching updates counts and retries remain idempotent', async () => {
  const team = { _id: 't', ...teamPayload(), memberCount: 2, status: 'recruiting' };
  const ctx = backend({ teams: [team] });
  const react = (reaction, enabled = true, actor = 'a') => ctx.setReaction({ teamId: 't', reaction, enabled }, actor);
  await ctx.setReaction({ teamId: 't', reaction: 'watch' }, 'a');
  for (const reaction of ['like', 'dislike', 'love', 'next', 'like']) {
    const result = await react(reaction);
    assert.deepEqual(Array.from(result.reactions.selected), [reaction]);
    for (const id of ['like', 'dislike', 'love', 'next', 'watch'])
      assert.equal(result.reactions.counts[id], id === reaction ? 1 : 0);
  }
  await react('like');
  assert.equal(team.reactionCounts.like, 1);
  await react('love', true, 'b');
  const staleCancel = await react('next', false);
  assert.equal(staleCancel.reactions.mine, 'like');
  await react('like', false);
  const cancelled = await react('like', false);
  assert.deepEqual(Array.from(cancelled.reactions.selected), []);
  assert.equal(cancelled.reactions.counts.like, 0);
  assert.equal(cancelled.reactions.counts.love, 1);
  assert.equal((await react('watch')).ok, false);
});
test('a new reaction reconciles legacy combined selections and their aggregate counts', async () => {
  const key = require('node:crypto').createHash('sha256').update(JSON.stringify(['t', 'a'])).digest('hex');
  const team = { _id: 't', ...teamPayload(), reactionCounts: {like: 2, love: 1, next: 1} };
  const ctx = backend({teams: [team]});
  await ctx.require('wx-server-sdk').database().collection('team_reactions').doc(key).set({
    data: {teamId:'t',reactions:['like','love','next'],reaction:'next'}
  });
  const result = await ctx.setReaction({teamId:'t',reaction:'dislike',enabled:true}, 'a');
  assert.deepEqual(Array.from(result.reactions.selected), ['dislike']);
  assert.equal(result.reactions.counts.like, 1);
  assert.equal(result.reactions.counts.love, 0);
  assert.equal(result.reactions.counts.next, 0);
  assert.equal(result.reactions.counts.dislike, 1);
});
test('every detail/share entry increments views including repeat users, with old watch votes untouched', async () => {
  const team = { _id: 't', ...teamPayload(), memberCount: 2, status: 'recruiting', reactionCounts: { watch: 99 } };
  const ctx = backend({ teams: [team] });
  await ctx.trackTeamEvent({ teamId: 't', kind: 'detail_view' }, 'a');
  await ctx.trackTeamEvent({ teamId: 't', kind: 'share_view' }, 'a');
  await ctx.trackTeamEvent({ teamId: 't', kind: 'detail_view' }, 'a');
  assert.equal(team.viewCount, 3);
  await ctx.trackTeamEvent({ teamId: 't', kind: 'copy_room' }, 'b');
  assert.equal(team.viewCount, 3);
  await ctx.trackTeamEvent({ teamId: 't', kind: 'share_view' }, 'b');
  assert.equal(team.viewCount, 4);
  assert.equal(team.reactionCounts.watch, 99);
  const card = (await ctx.listTeams({}, 'visitor')).list[0];
  assert.equal(card.viewCount, 4);
  assert.equal(card.openid, undefined);
});


test('hot ranking uses views and current reactions globally before pagination and matches local sorting', async () => {
  const now = Date.now();
  const base = { ...teamPayload(), memberCount: 1, status: 'recruiting', startAt: now + 600000, endAt: now + 3600000, createdAt: 1 };
  const teams = [
    { ...base, _id: 'views', viewCount: 12 },
    { ...base, _id: 'likes', viewCount: 1, reactionCounts: { like: 5 } },
    { ...base, _id: 'love', viewCount: 2, reactionCounts: { love: 4, next: 4 }, memberCount: 5, status: 'full' },
    { ...base, _id: 'down', viewCount: 20, reactionCounts: { dislike: 10 } },
    { ...base, _id: 'legacy', viewCount: -1, reactionCounts: { watch: 999, like: -3 } },
    { ...base, _id: 'new-tie', viewCount: 12, createdAt: 2 },
    { ...base, _id: 'missing', viewCount: 'invalid' },
  ];
  const ctx = backend({ teams });
  const first = await ctx.listTeams({ sortMode: 'hot', limit: 2 }, '');
  const second = await ctx.listTeams({ sortMode: 'hot', offset: first.nextOffset, limit: 50 }, '');
  const ordered = [...first.list, ...second.list];
  const expected = ['love', 'likes', 'new-tie', 'views', 'legacy', 'missing', 'down'];
  assert.deepEqual(ordered.map(t => t._id), expected);
  assert.deepEqual(loadUtility('lobby').sortTeams(ordered.reverse(), 'hot').map(t => t._id), expected);
  await ctx.setReaction({ teamId: 'likes', reaction: 'like', enabled: true }, 'visitor');
  assert.equal((await ctx.listTeams({ sortMode: 'hot' }, '')).list[0]._id, 'likes');
  await ctx.setReaction({ teamId: 'likes', reaction: 'like', enabled: false }, 'visitor');
  assert.equal((await ctx.listTeams({ sortMode: 'hot' }, '')).list[0]._id, 'love');
});

test('concurrent complete-form claims elect one host without adding a second car or member', async () => {
  const team = { _id: 'night_test', ...teamPayload(), platform: 'Steam', dailyNightId: 'test', pendingHost: true, memberCount: 0, roomNo: '', status: 'recruiting' };
  const members = [], teams = [team];
  const ctx = backend({ teams, members, users: [{ _id: 'a', nickName: 'A' }, { _id: 'b', nickName: 'B' }] });
  const input = { claimTeamId: team._id, team: { ...team, roomNo: '好友码123' } };
  const results = await Promise.all(['a', 'b'].map(uid => ctx.createTeam(input, uid)));
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.find(result => !result.ok).code, "CLAIM_TAKEN");
  assert.equal(teams.length, 1);
  assert.equal(members.length, 1);
  assert.equal(team.memberCount, 1);
  assert.equal(team.pendingHost, false);
  assert.equal(members[0].openid, team.openid);
});
test('user ranking endpoint scans past the first page and returns public profiles only', async () => {
  const users = [{ _id: 'top', nickName: '榜首', avatarUrl: 'cloud://env/avatar.png', bio: '公开签名' }, { _id: 'other', nickName: '其他' }];
  const teams = Array.from({ length: 130 }, (_, i) => ({ _id: 't' + i, ...teamPayload(), openid: i < 100 ? 'other' : 'top' }));
  const ctx = backend({ teams, users, paginate: true });
  const result = await ctx.getUserRankings();
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(result.hosted, row => row.count), [100, 30]);
  assert.ok(result.hosted[1].avatarUrl.startsWith('https://tmp.example/'));
  assert.equal(result.hosted[1].bio, '公开签名');
  assert.equal(result.hosted[0].bio, '');
  assert.ok(!JSON.stringify(result).includes('reminderPreferences'));
  assert.ok(!JSON.stringify(result).includes('openid'));
  assert.equal(result.hosted[0]._id, undefined);
});

test('official car labels survive API projection and claiming; normal publishers cannot forge official metadata', async () => {
  const ctx = backend({ users: [{ _id: 'u', nickName: '用户' }] });
  const champion = ctx.stripSecret({ _id: 'c', ...teamPayload(), dailyNightId: 'today', dailyOptionId: 'vote' }, false);
  assert.equal(champion.officialSource, 'champion');
  const random = ctx.stripSecret({ _id: 'r', ...teamPayload(), dailyNightId: 'today', officialSource: 'random' }, false);
  assert.equal(random.officialSource, 'random');
  const created = await ctx.createTeam({ team: { ...teamPayload(), dailyNightId: 'forged', officialSource: 'champion' } }, 'u');
  assert.equal(created.ok, true);
  const result = await ctx.getTeam({ teamId: created.teamId }, 'u');
  assert.equal(result.team.dailyNightId, undefined);
  assert.equal(result.team.officialSource, undefined);
});

test('optional profile preferences validate, preserve omitted fields and explicitly clear', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({ users });
  const selected = { groupIds: ['underground-gaming'], favoriteGames: ['CS2'], playTimes: ['weekend'] };
  assert.equal((await ctx.saveProfile({ nickName: '玩家', ...selected }, 'u')).ok, true);
  await ctx.saveProfile({ nickName: '改名' }, 'u');
  for (const key of Object.keys(selected)) assert.deepEqual([...users[0][key]], selected[key]);
  for (const invalid of [
    { groupIds: ['invented-group'] }, { groupIds: 'underground-gaming' },
    { favoriteGames: Array(6).fill('CS2') }, { favoriteGames: [42] },
    { playTimes: ['invented-time'] }, { playTimes: null },
  ]) {
    assert.equal((await ctx.saveProfile({ nickName: '不应保存', ...invalid }, 'u')).ok, false);
    assert.equal(users[0].nickName, '改名');
  }
  assert.equal((await ctx.saveProfile({ nickName: '改名', groupIds: [], favoriteGames: [], playTimes: [] }, 'u')).ok, true);
  for (const key of Object.keys(selected)) assert.equal(users[0][key].length, 0);
});

test('favorite game text is moderated before persistence and public preferences exclude account data', async () => {
  const users = [{ _id: 'u', nickName: '玩家', groupIds: ['underground-gaming'], favoriteGames: ['CS2'], playTimes: ['weekend'], privateField: 'secret' }];
  const ctx = backend({ users, msgCheck: async () => ({ result: { suggest: 'risky' } }) });
  assert.equal((await ctx.saveProfile({ nickName: '玩家', favoriteGames: ['不安全游戏'] }, 'u')).ok, false);
  assert.deepEqual(users[0].favoriteGames, ['CS2']);
  const profile = ctx.publicProfile(users[0], {});
  assert.deepEqual([...profile.groupIds], ['underground-gaming']);
  assert.deepEqual([...profile.favoriteGames], ['CS2']);
  assert.deepEqual([...profile.playTimes], ['weekend']);
  assert.equal(profile.privateField, undefined);
});

test('group filter uses OR semantics, excludes untagged teams only when selected and paginates after filtering', async () => {
  const base = { ...teamPayload(), memberCount: 1, status: 'recruiting' };
  const teams = Array.from({ length: 130 }, (_, i) => ({ ...base, _id: 'group-' + i, createdAt: i, ...(i >= 120 ? { groupIds: ['underground-gaming'] } : {}) }));
  const ctx = backend({ teams, paginate: true });
  assert.equal((await ctx.listTeams({}, '')).total, 130);
  assert.equal((await ctx.listTeams({ groupIds: [] }, '')).total, 130);
  const query = { groupIds: ['underground-gaming'], limit: 3 };
  const first = await ctx.listTeams(query, '');
  assert.equal(first.total, 10);
  assert.equal(first.hasMore, true);
  assert.deepEqual([...first.list.map(t => t._id)], ['group-129', 'group-128', 'group-127']);
  const next = await ctx.listTeams({ ...query, offset: first.nextOffset }, '');
  assert.deepEqual([...next.list.map(t => t._id)], ['group-126', 'group-125', 'group-124']);
  assert.equal(ctx.matchTeamSearch({ groupIds: ['b'] }, { groupIds: ['a', 'b'] }, Date.now()), true);
  assert.equal(ctx.matchTeamSearch({}, { groupIds: ['a', 'b'] }, Date.now()), false);
  assert.equal((await ctx.listTeams({ groupIds: 'underground-gaming' }, '')).ok, false);
});

test('normal and proxy publication snapshot actual host group and ignore client supplied groups', async () => {
  const users = [
    { _id: 'host', nickName: '车头', groupIds: ['underground-gaming'] },
    { _id: 'helper', nickName: '代开', groupIds: [] },
  ];
  const teams = [];
  const ctx = backend({ users, teams, organizers: [{ _id: 'helper' }] });
  const payload = { team: { ...teamPayload(), groupIds: ['fake'] } };
  assert.equal((await ctx.createTeam(payload, 'host')).ok, true);
  assert.deepEqual([...teams[0].groupIds], ['underground-gaming']);
  assert.equal((await ctx.createTeam({ ...payload, hostOpenid: 'host' }, 'helper')).ok, true);
  assert.deepEqual([...teams[1].groupIds], ['underground-gaming']);
  await ctx.saveProfile({ nickName: '车头', groupIds: [] }, 'host');
  assert.deepEqual([...teams[0].groupIds], ['underground-gaming']);
  assert.deepEqual([...teams[1].groupIds], ['underground-gaming']);
});

test('contact fields preserve leading zeros, round trip publicly, survive older clients and clear explicitly', async () => {
  const users = [{ _id: 'u', nickName: '玩家', privateField: 'secret' }];
  const ctx = backend({ users });
  assert.equal((await ctx.saveProfile({ nickName: '玩家', steamFriendCode: ' 00123456 ', wechatId: ' Player_123 ', favoriteGames: ['自己写的游戏'] }, 'u')).ok, true);
  assert.equal(users[0].steamFriendCode, '00123456');
  assert.equal(users[0].wechatId, 'Player_123');
  await ctx.saveProfile({ nickName: '改名' }, 'u');
  const profile = ctx.publicProfile(users[0], {});
  assert.equal(profile.steamFriendCode, '00123456');
  assert.equal(profile.wechatId, 'Player_123');
  assert.deepEqual([...profile.favoriteGames], ['自己写的游戏']);
  assert.equal(profile.privateField, undefined);
  await ctx.saveProfile({ nickName: '改名', steamFriendCode: '', wechatId: '' }, 'u');
  assert.equal(ctx.publicProfile(users[0], {}).steamFriendCode, '');
  assert.equal(users[0].wechatId, '');
});

test('invalid contact payloads fail before any profile write', async () => {
  const users = [{ _id: 'u', nickName: '玩家' }];
  const ctx = backend({ users });
  for (const invalid of [
    { steamFriendCode: 123456 }, { steamFriendCode: 'not-a-code' }, { steamFriendCode: '1'.repeat(21) },
    { wechatId: [] }, { wechatId: 'id with spaces' }, { wechatId: 'a'.repeat(33) },
  ]) {
    assert.equal((await ctx.saveProfile({ nickName: '不应保存', ...invalid }, 'u')).ok, false);
    assert.equal(users[0].nickName, '玩家');
  }
});
