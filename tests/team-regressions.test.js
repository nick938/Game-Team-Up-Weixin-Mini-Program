const { harness } = require('./support/miniapp.cjs');
const loadUtility = name => harness().load('utils/' + name);
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function backend({ teams = [], members = [], users = [], feedback = [], reports = [], rateLimits = [], admins = [], organizers = [], send = async () => {}, env = {}, sendMail, imgCheck, msgCheck, paginate = false } = {}) {
  const tables = { teams, members, users, feedback, reports, rate_limits: rateLimits, admins, organizers };
  const deleted = [];
  const db = {
    command: { gte: () => ({ and: () => ({}) }), lte: () => ({}), in: () => ({}) },
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
  assert.equal(recruiting.statusText, '还差 7 人');
  assert.equal(recruiting.needText, '还差 7 人');
  assert.equal(recruiting.countText, '5/12');
  assert.match(recruiting.timeText, /21:00/);
  // 「不限」和空值不该占位置
  assert.deepEqual(recruiting.tags, ['Steam', '亚服']);

  assert.equal(coverContent(null), null);
  // 满员后不再显示「还差 N 人」，否则分享出去人数是矛盾的
  const full = coverContent({ ...live, displayStatus: 'full', memberCount: 12 });
  assert.equal(full.statusText, '已满员');
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
  assert.deepEqual(Object.keys(result.profile).sort(), ['avatarUrl', 'avatarBase64', 'bio', 'nickName'].sort());
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

test('team note supports up to 500 characters and clamps beyond', () => {
  const ctx = backend();
  const startAt = Date.now() + 60 * 1000;
  const longNote = 'A'.repeat(550);
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
  assert.equal(validated.value.note.length, 500);
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
  // 凑满一页即停，nextOffset 指向下一条未消费的原始记录（已取消项会被跳过）。
  assert.equal(page.nextOffset, 3);
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
  // 热度按上车人数；人数相同再按最新创建。
  const tie = [
    { _id: 'a', createdAt: now - 1000, memberCount: 3 },
    { _id: 'b', createdAt: now - 90000, memberCount: 3 },
    { _id: 'c', createdAt: now - 5000, memberCount: 4 },
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
  // 只搜索不筛选，按最热（人数缺省为 0，回落到创建时间）排序。
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

test('cloud requires a room / join method for creating and editing', () => {
  const ctx = backend();
  for (const isCreate of [true, false]) {
    for (const roomNo of [undefined, '', '   ', '\t\n']) {
      assert.equal(ctx.validateTeamInput({ ...teamPayload(), roomNo }, { isCreate }).error, '请填写房间 / 加入方式');
    }
    const valid = ctx.validateTeamInput({ ...teamPayload(), roomNo: '  Steam 好友代码 123456  ' }, { isCreate });
    assert.equal(valid.error, undefined);
    assert.equal(valid.value.roomNo, 'Steam 好友代码 123456');
    assert.equal(valid.value.roomPwd, '');
  }
});
