import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');
const event = (dataset = {}, value = '') => ({ currentTarget: { dataset }, detail: { value } });
const team = { _id: 'team-1', gameName: 'CS2', platform: 'Steam', roomNo: '123456', startAt: Date.now() + 3600000, endAt: Date.now() + 7200000, capacity: 5, memberCount: 1, displayStatus: 'recruiting' };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('joining requests authorization before writing even when permission is declined', async () => {
  const order = [];
  const h = harness({ requestTeamNotify: async () => { order.push('subscribe'); return false; }, callTeam: async action => { order.push(action); return { ok: true, team, members: [], role: 'member' }; } });
  const page = h.page('pages/team/detail'); page.state.teamId = team._id;
  await page.onJoin(); assert.deepEqual(order.slice(0, 2), ['subscribe', 'joinTeam']);
});

test('detail current query wins over launch query and both share entries retain its id', () => {
  const h = harness({ launch: { query: { id: 'old' } } }), page = h.page('pages/team/detail');
  page.hooks.onLoad({ id: team._id }); page.state.team = team;
  assert.equal(page.state.teamId, team._id);
  assert.equal(page.hooks.onShareAppMessage().path, '/pages/team/detail?id=team-1');
  assert.equal(page.hooks.onShareTimeline().query, 'id=team-1');
  page.state.shareCoverPath = 'wxfile://cover.jpg';
  assert.equal(page.hooks.onShareAppMessage().imageUrl, 'wxfile://cover.jpg');
});

test('empty detail id never queries the backend', async () => {
  const h = harness(), page = h.page('pages/team/detail'); await page.loadDetail(); assert.equal(h.calls.length, 0);
});

test('only the host can open management and dispatch edit/cancel', () => {
  const h = harness(), page = h.page('pages/team/detail');
  page.onManage(); assert.equal(page.state.showManage, false);
  page.state.role = 'host'; page.state.teamId = team._id; page.onManage(); assert.equal(page.state.showManage, true);
  page.onManageAction(event({ action: 'edit' })); assert.equal(h.store.editingTeamId, team._id); assert.equal(page.state.showManage, false);
});

test('member profiles ignore stale responses after switching or closing the sheet', async () => {
  const pending = [];
  const h = harness({ callTeam: () => new Promise(resolve => pending.push(resolve)) }), page = h.page('pages/team/detail');
  page.state.teamId = team._id; page.state.selectedMemberId = 'a'; const first = page.loadMemberProfile();
  page.state.selectedMemberId = 'b'; const second = page.loadMemberProfile();
  pending[1]({ profile: { nickName: 'b' } }); await second;
  pending[0]({ profile: { nickName: 'a' } }); await first; assert.equal(page.state.memberProfile.nickName, 'b');
  const last = page.loadMemberProfile(); page.closeMemberProfile(); pending[2]({ profile: { nickName: 'late' } }); await last;
  assert.equal(page.state.memberProfile, null); assert.equal(page.state.showMemberProfile, false);
});

test('long detail notes start collapsed and can expand', async () => {
  const h = harness({ callTeam: async () => ({ team: { ...team, note: '长'.repeat(81) }, members: [], role: null }) }), page = h.page('pages/team/detail');
  page.state.teamId = team._id; await page.loadDetail(); assert.equal(page.state.noteCanFold, true); assert.equal(page.state.noteExpanded, false);
  page.toggleNoteExpand(); assert.equal(page.state.noteExpanded, true);
});

test('welcome dismissal persists across component instances and feedback still navigates', () => {
  const h = harness(), first = h.page('components/welcome-letter/index'); first.hooks.mounted(); assert.equal(first.state.show, true);
  first.dismiss(); const second = h.page('components/welcome-letter/index'); second.hooks.mounted(); assert.equal(second.state.show, false);
  second.openFeedback(); assert.equal(h.navigation.at(-1), '/pages/feedback/feedback');
});

test('editing survives another onShow and writes update instead of create', async () => {
  const h = harness({ store: { editingTeamId: team._id }, callTeam: async action => action === 'getTeam' ? { team } : { ok: true } }), page = h.page('pages/publish/publish');
  await page.hooks.onShow(); await page.hooks.onShow(); assert.equal(page.state.editingId, team._id);
  await page.onSubmit(); assert.ok(h.calls.some(call => call.action === 'updateTeam')); assert.ok(!h.calls.some(call => call.action === 'createTeam'));
});

test('successful create clears the form and prevents a second identical submission', async () => {
  const h = harness({ callTeam: async () => ({ teamId: team._id }) }), page = h.page('pages/publish/publish');
  Object.assign(page.state, { gameName: 'CS2', roomNo: '123456' }); await page.onSubmit(); await page.onSubmit();
  assert.equal(h.calls.filter(call => call.action === 'createTeam').length, 1); assert.equal(page.state.gameName, '');
});

test('game landing page shares the selected game and prefills publish even if listing fails', async () => {
  const h = harness({ callTeam: async () => { throw new Error('offline'); } }), page = h.page('pages/game/game');
  page.hooks.onLoad({ game: 'peace' }); await page.loadList(); assert.match(page.state.seoTitle, /和平精英/);
  assert.match(page.hooks.onShareTimeline().query, /game=peace/); page.goPublish(); assert.equal(h.store.prefillGame.name, '和平精英');
  const publish = h.page('pages/publish/publish'); await publish.hooks.onShow(); assert.equal(publish.state.gameName, '和平精英');
});

test('publish retains optional fields when folded and uses the real switch checked value', () => {
  const h = harness(), page = h.page('pages/publish/publish'); page.state.canProxy = true;
  page.toggleProxy(event({}, true)); assert.equal(page.state.proxyMode, true);
  page.toggleProxy(event({}, false)); assert.equal(page.state.proxyMode, false);
  page.onRoomNo(event({}, 'room')); page.toggleMore(); page.toggleMore(); assert.equal(page.state.roomNo, 'room');
});

test('proxy search responses are ignored after disabling proxy mode', async () => {
  let resolve;
  const h = harness({ callTeam: () => new Promise(done => { resolve = done; }) }), page = h.page('pages/publish/publish');
  page.state.canProxy = true; page.state.proxyMode = true; const pending = page.searchProxyUsers('玩家');
  page.toggleProxy(event({}, false)); resolve({ list: [{ userId: 'user', nickName: '玩家' }] }); await pending;
  assert.deepEqual(page.state.proxyResults, []);
});

test('duration and start changes recompute endAt while payload contains only business fields', () => {
  const page = harness().page('pages/publish/publish'); page.pickDuration(event({ hours: 3 }));
  assert.equal(page.buildTeam().endAt - page.buildTeam().startAt, 3 * 3600000);
  page.onStartTime(event({}, '18:00')); assert.equal(page.buildTeam().endAt - page.buildTeam().startAt, 3 * 3600000);
  page.pickCustomDuration(event({}, '0')); assert.equal(page.buildTeam().endAt - page.buildTeam().startAt, 30 * 60000);
  assert.equal('durationLabel' in page.buildTeam(), false); assert.equal('durationMinutes' in page.buildTeam(), false);
});

test('mine keeps signature and separate hosted/joined counts', async () => {
  const h = harness({ callTeam: async action => action === 'getProfile' ? { user: { nickName: '玩家', bio: 'Steam:123' } } : { hosted: [team], joined: [team, { ...team, _id: 'past', displayStatus: 'ended' }] } }), page = h.page('pages/mine/mine');
  await page.load(); assert.equal(page.state.profileHint, 'Steam:123'); assert.equal(page.state.hostedCount, 1); assert.equal(page.state.joinedCount, 2);
});

test('legal documents switch in place with a safe fallback', () => {
  const page = harness().page('pages/legal/legal'); page.hooks.onLoad({ type: 'agreement' }); assert.equal(page.state.title, '用户协议');
  page.pickDoc(event({ type: 'community' })); assert.equal(page.state.title, '社区公约'); page.showDoc('unknown'); assert.equal(page.state.title, '隐私政策');
});

test('returning to the lobby resets game filter and preserves search/sort', async () => {
  const h = harness(), page = h.page('pages/index/index'); Object.assign(page.state, { gameFilter: 'CS2', keyword: 'room', sortMode: 'hot' });
  page.hooks.onShow(); await flush(); assert.equal(page.state.gameFilter, '全部'); assert.equal(page.state.keyword, 'room'); assert.equal(page.state.sortMode, 'hot');
});

test('non-detail shareable pages use the lobby path and package image fallback', () => {
  for (const route of ['index/index', 'mine/mine', 'publish/publish']) {
    const page = harness().page('pages/' + route);
    assert.equal(page.hooks.onShareAppMessage().path, '/pages/index/index');
    assert.equal(page.hooks.onShareTimeline().path, undefined);
    assert.equal(page.hooks.onShareAppMessage().imageUrl, '/static/images/share/cover-v1.jpg');
  }
});

test('release version follows host metadata while development uses local version', () => {
  for (const envVersion of ['develop', 'trial', 'release']) {
    const h = harness({ platform: { getAccountInfoSync: () => ({ miniProgram: { envVersion, version: envVersion === 'release' ? '9.9.9' : '' } }) } });
    const ver = h.load('utils/version').getAppVersion(); assert.equal(ver.version === '9.9.9', envVersion === 'release');
  }
});

test('subscription asks only on WeChat and only accept counts as authorization', async () => {
  for (const [target, response, expected] of [['mp-weixin', 'accept', true], ['mp-weixin', 'reject', false], ['mp-qq', 'accept', false]]) {
    let called = false;
    const h = harness({ target, overrides: { 'utils/subscribe': null }, uni: { requestSubscribeMessage: ({ tmplIds, success }) => { called = true; success({ [tmplIds[0]]: response }); } } });
    assert.equal(await h.load('utils/subscribe').requestTeamNotify(), expected); assert.equal(called, target === 'mp-weixin');
  }
});

test('admin denial is surfaced and user filters combine keyword with banned state', async () => {
  const denied = harness({ callTeam: async () => { throw new Error('没有管理权限'); } }).page('pages/admin/admin');
  await denied.load(); assert.equal(denied.state.denied, true); assert.equal(denied.state.loading, false);
  const page = harness().page('pages/admin/admin');
  page.applyUsersFilter([{ _id: 'a', nickName: '小明', banned: true }, { _id: 'b', nickName: '小红', banned: false }]);
  page.state.bannedOnly = true; page.applyUsersFilter(undefined, '小'); assert.deepEqual(page.state.list.map(row => row._id), ['a']);
  page.applyUsersFilter(undefined, '小红'); assert.equal(page.state.list.length, 0);
});

test('feedback and bug forms reject blank templates before sending a request', async () => {
  for (const route of ['feedback/feedback', 'bug/bug']) {
    const h = harness(), page = h.page('pages/' + route); await page.onSubmit();
    assert.equal(h.calls.length, 0); assert.equal(h.toasts.length, 1); assert.equal(page.state.submitting, false);
  }
});

test('report requires both a reason and target and submits the chosen values', async () => {
  const h = harness(), page = h.page('pages/report/report'); await page.onSubmit(); assert.equal(h.calls.length, 0);
  page.pickReason(event({ name: '广告营销' })); await page.onSubmit(); assert.equal(h.calls.length, 0);
  page.hooks.onLoad({ teamId: team._id, name: 'CS2' }); await page.onSubmit();
  assert.equal(h.calls[0].action, 'submitReport'); assert.equal(h.calls[0].input.targetId, team._id); assert.equal(h.calls[0].input.reason, '广告营销');
});

test('game selection reorders the original platform values without adding new values', () => {
  const page = harness().page('pages/publish/publish'), original = [...page.state.platforms].sort();
  page.pickSuggestedGame(event({ slug: 'wangzhe' })); assert.equal(page.state.platform, '手游');
  assert.deepEqual([...page.state.platforms].sort(), original); assert.equal(page.state.gameName, '王者荣耀');
});
