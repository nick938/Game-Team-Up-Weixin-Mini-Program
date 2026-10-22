import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

test('editing migrates legacy server and teammate requirements into the note without losing contact or password', async () => {
  const h = harness({
    callTeam: () => ({
      role: 'host',
      team: {
        _id: 'legacy',
        gameName: 'CS2',
        platform: 'Steam',
        capacity: 5,
        memberCount: 3,
        roomNo: '好友码 123',
        roomPwd: 'secret',
        server: '国服',
        rankReq: '萌新友好',
        note: '娱乐局',
        startAt: Date.now() + 3600000,
        endAt: Date.now() + 10800000,
      },
    }),
  });
  const page = h.page('pages/publish/publish');
  await page.loadEdit('legacy');
  assert.equal(page.state.note, '区服：国服\n队友要求：萌新友好\n娱乐局');
  assert.equal(page.state.server, '');
  assert.equal(page.state.rankReq, '');
  assert.equal(page.state.roomNo, '好友码 123');
  assert.equal(page.state.roomPwd, 'secret');
  assert.equal(page.state.minimumCapacity, 3);
});

test('unfinished draft survives remount with a future date, duration, note and contact, without restoring a password', async () => {
  const storage = new Map();
  const platform = {
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
  };
  const first = harness({ platform }).page('pages/publish/publish');
  first.onGameName('我的游戏');
  first.onRoomNo('微信：player');
  first.onRoomPwd('old-password');
  first.onNote('房间123，萌新友好');
  first.changeStart(Date.now() + 86400000);
  first.changeDuration(90);
  first.state.capacity = 6;
  first.hooks.onHide();
  const second = harness({ platform }).page('pages/publish/publish');
  await second.hooks.onShow();
  assert.equal(second.state.gameName, '我的游戏');
  assert.equal(second.state.roomNo, '微信：player');
  assert.equal(second.state.roomPwd, '');
  assert.equal(second.state.note, first.state.note);
  assert.equal(second.state.capacity, 6);
  assert.equal(second.state.durationMinutes, 90);
  assert.equal(second.state.startDate, first.state.startDate);
  assert.equal(second.state.startTime, first.state.startTime);
});

test('expired draft gets a fresh start while retaining its chosen duration', async () => {
  const h = harness();
  h.storage.set('publish-draft-v2', {
    gameName: 'CS2',
    capacity: 4,
    roomNo: '好友码123',
    platform: 'Steam',
    startAt: Date.now() - 86400000,
    endAt: Date.now() - 86400000 + 3600000,
  });
  const page = h.page('pages/publish/publish');
  await page.hooks.onShow();
  assert.ok(page.view.startTimestamp > Date.now());
  assert.equal(page.state.durationMinutes, 60);
});

test('successful publish remembers per-game settings, clears its draft and reuses contact without a stale password', async () => {
  const h = harness({
    callTeam: (action) => (action === 'myTeams' ? { hosted: [], joined: [] } : { teamId: 'new' }),
  });
  const page = h.page('pages/publish/publish');
  page.pickSuggestedGame('CS2');
  page.onRoomNo('Steam 123456');
  page.onRoomPwd('private');
  page.state.capacity = 6;
  page.changeDuration(90);
  page.hooks.onHide();
  await page.onSubmit();
  assert.equal(h.storage.get('publish-draft-v2'), null);
  page.pickSuggestedGame('CS2');
  assert.equal(page.state.roomNo, 'Steam 123456');
  assert.equal(page.state.roomPwd, '');
  assert.equal(page.state.capacity, 6);
  assert.equal(page.state.durationMinutes, 90);
  const write = h.calls.find((item) => item.action === 'createTeam');
  assert.equal(write.input.team.roomNo, 'Steam 123456');
  assert.equal(write.input.team.note, '');
});

test('proxy contact never replaces the users own saved contact', async () => {
  const h = harness({
    callTeam: (action) => (action === 'myTeams' ? { hosted: [], joined: [] } : { teamId: 'proxy' }),
  });
  h.storage.set('publish-game-v2:CS2', { contact: '我的好友码', capacity: 4 });
  const page = h.page('pages/publish/publish');
  page.state.proxyMode = true;
  page.state.proxyHost = { userId: 'friend' };
  page.pickSuggestedGame('CS2');
  assert.equal(page.state.roomNo, '');
  page.onRoomNo('朋友的好友码');
  await page.onSubmit();
  assert.equal(h.storage.get('publish-game-v2:CS2').contact, '我的好友码');
});

test('a draft can restore notes before choosing a game, and retired weekly drafts restore as ordinary teams', async () => {
  for (const gameName of ['', 'CS2']) {
    const h = harness();
    const startAt = Date.now() + 86400000;
    h.storage.set('publish-draft-v2', {
      gameName,
      capacity: 4,
      roomNo: '好友码123',
      note: '萌新友好',
      platform: 'Steam',
      startAt,
      endAt: startAt + 7200000,
      ...(gameName ? { weeklyId: 'friday' } : {}),
    });
    const page = h.page('pages/publish/publish');
    await page.hooks.onShow();
    assert.equal(page.state.gameName, gameName);
    assert.equal(page.state.note, '萌新友好');
    assert.equal(page.state.weeklyId, '');
    assert.equal(page.buildTeam().weeklyId, undefined);
    assert.equal(page.buildTeam().startAt, Math.floor(startAt / 60000) * 60000);
  }
});

test('recent launches keep the latest three distinct games including older dates and cache refreshes', async () => {
  const now = Date.now();
  const row = (id, gameName, days) => ({
    _id: id,
    gameName,
    createdAt: now - days * 86400000,
    startAt: now - days * 86400000,
    endAt: now - days * 86400000 + 7200000,
    capacity: 4,
    platform: 'Steam',
  });
  const h = harness({
    callTeam: () => ({
      hosted: [
        row('old', '过期游戏', 8),
        row('cs-old', 'CS2', 3),
        row('latest', 'CS2', 1),
        row('other', '饥荒', 2),
        row('fourth', '王者荣耀', 9),
        row('fifth', '和平精英', 10),
      ],
      joined: [row('joined', '别人开的车', 0)],
    }),
  });
  const page = h.page('pages/publish/publish');
  await page.loadRecentLaunches();
  await page.loadRecentLaunches();
  assert.deepEqual(
    page.state.recentLaunches.map((team) => team._id),
    ['latest', 'other', 'old'],
  );
  assert.equal(h.calls.length, 1);
});

test('reusing a launch copies its configuration, renews the date at the same clock time and never reuses a password', () => {
  const h = harness();
  const page = h.page('pages/publish/publish');
  const previous = new Date(Date.now() - 3 * 86400000);
  previous.setHours(20, 30, 0, 0);
  const startAt = previous.getTime();
  page.reuseLaunch({
    _id: 'previous',
    gameName: 'CS2',
    platform: 'Steam',
    capacity: 6,
    memberCount: 1,
    startAt,
    endAt: startAt + 5400000,
    roomNo: '好友码123456',
    roomPwd: 'old-secret',
    voice: 'KOOK',
    server: '国服',
    note: '娱乐局',
  });
  assert.equal(page.state.gameName, 'CS2');
  assert.equal(page.state.capacity, 6);
  assert.equal(page.state.durationMinutes, 90);
  assert.equal(page.state.startTime, '20:30');
  assert.ok(page.view.startTimestamp > Date.now());
  assert.equal(page.state.roomNo, '好友码123456');
  assert.equal(page.state.roomPwd, '');
  assert.equal(page.state.voice, 'KOOK');
  assert.equal(page.state.note, '区服：国服\n娱乐局');
  assert.equal(page.state.selectedHistoryId, 'previous');
  assert.equal(page.state.editingId, '');
  assert.equal(page.state.weeklyId, '');
});

test('history failure preserves manually entered fields and new forms default to KOOK', async () => {
  const h = harness({
    callTeam: () => {
      throw new Error('offline');
    },
  });
  const page = h.page('pages/publish/publish');
  assert.equal(page.state.voice, 'KOOK');
  page.onGameName('我的游戏');
  page.onRoomNo('好友码123');
  await page.loadRecentLaunches();
  assert.equal(page.state.gameName, '我的游戏');
  assert.equal(page.state.roomNo, '好友码123');
  assert.deepEqual(page.state.recentLaunches, []);
  assert.deepEqual(h.toasts, []);
});

test('history keeps a future start and cannot overwrite a team being edited', () => {
  const page = harness().page('pages/publish/publish');
  const start = new Date(Date.now() + 86400000);
  start.setSeconds(0, 0);
  const team = {
    _id: 'future',
    gameName: 'CS2',
    platform: 'Steam',
    capacity: 5,
    startAt: start.getTime(),
    endAt: start.getTime() + 3600000,
  };
  page.reuseLaunch(team);
  assert.equal(page.view.startTimestamp, start.getTime());
  assert.equal(page.state.durationMinutes, 60);
  page.state.editingId = 'editing';
  page.reuseLaunch({ ...team, gameName: '其他游戏' });
  assert.equal(page.state.gameName, 'CS2');
});

test('a remembered standard duration selects its shortcut instead of showing a redundant custom row', () => {
  const page = harness().page('pages/publish/publish');
  page.changeDuration(120);
  assert.equal(page.state.durationHours, 2);
  page.changeDuration(90);
  assert.equal(page.state.durationHours, 0);
});

test('manually changing the game deselects its reused history without discarding other fields', () => {
  const page = harness().page('pages/publish/publish');
  const startAt = Date.now() + 3600000;
  const team = {
    _id: 'recent',
    gameName: 'CS2',
    platform: 'Steam',
    capacity: 5,
    startAt,
    endAt: startAt + 7200000,
    roomNo: '好友码123',
    note: '娱乐局',
  };
  for (const name of ['新游戏']) {
    page.reuseLaunch(team);
    assert.equal(page.state.selectedHistoryId, 'recent');
    page.onGameName(name);
    assert.equal(page.state.gameName, name);
    assert.equal(page.state.selectedHistoryId, '');
    assert.equal(page.state.capacity, 5);
    assert.equal(page.state.roomNo, '好友码123');
    assert.equal(page.state.note, '娱乐局');
  }
});

test('clearing a reused launch resets all filled fields and its saved draft while retaining history and proxy identity', () => {
  const h = harness();
  const page = h.page('pages/publish/publish');
  const startAt = Date.now() + 86400000;
  const team = {
    _id: 'recent',
    gameName: 'CS2',
    platform: 'Steam',
    capacity: 6,
    startAt,
    endAt: startAt + 5400000,
    roomNo: '好友码123',
    note: '娱乐局',
    voice: '微信',
  };
  page.state.recentLaunches = [team];
  page.reuseLaunch(team);
  page.onRoomPwd('new-password');
  page.hooks.onHide();
  assert.ok(h.storage.get('publish-draft-v2'));
  page.state.proxyMode = true;
  page.state.proxyHost = { userId: 'friend', nickName: '朋友' };
  page.onGameName('');
  assert.equal(page.state.gameName, '');
  assert.equal(page.state.selectedHistoryId, '');
  assert.equal(page.state.roomNo, '');
  assert.equal(page.state.roomPwd, '');
  assert.equal(page.state.note, '');
  assert.equal(page.state.server, '');
  assert.equal(page.state.rankReq, '');
  assert.equal(page.state.capacity, 4);
  assert.equal(page.state.durationMinutes, 120);
  assert.equal(page.state.voice, 'KOOK');
  assert.equal(page.state.weeklyId, '');
  assert.ok(page.view.startTimestamp < startAt);
  assert.equal(page.state.proxyMode, true);
  assert.equal(page.state.proxyHost.userId, 'friend');
  assert.equal(page.state.recentLaunches[0]._id, 'recent');
  assert.equal(h.storage.get('publish-draft-v2'), null);
});
