const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', 'miniprogram');

function runtime(options) {
  const calls = [];
  let app, page, component;
  const cache = new Map();
  const wx = {
    getLaunchOptionsSync: () => options,
    getEnterOptionsSync: () => options,
    setNavigationBarTitle() {},
    stopPullDownRefresh() {},
    getStorageSync: () => { calls.push('storage'); return false; },
    hideTabBar: () => calls.push('tab'),
    showTabBar: () => calls.push('tab'),
    cloud: {
      init: () => calls.push('init'),
      callFunction: async ({ data }) => {
        calls.push(data.type);
        return { result: { ok: true, user: { nickName: '玩家' }, list: [], hosted: [], joined: [], team: { gameName: 'CS2', capacity: 5, startAt: Date.now() } } };
      },
    },
    showToast: () => calls.push('toast'),
  };
  function load(file) {
    file = path.resolve(root, file);
    if (!file.endsWith('.js')) file += '.js';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
      module, wx, console, setTimeout, clearTimeout,
      require: name => load(path.resolve(path.dirname(file), name)),
      getApp: () => app,
      App: value => { app = value; },
      Page: value => { page = value; },
      Component: value => { component = value; },
    }, { filename: file });
    return module.exports;
  }
  function attach(value) {
    value.setData = patch => Object.assign(value.data, patch);
    return value;
  }
  return { calls, load,
    app() { load('app'); app.onLaunch(options); return app; },
    page(route) { load(`pages/${route}`); return attach(page); },
    welcome() { load('components/welcome-letter/index'); Object.assign(component, component.methods); return attach(component); },
  };
}

test('single-page mode and older timeline scene are detected; normal mode wins over scene', () => {
  const { isSinglePage } = runtime({}).load('utils/runtime');
  assert.equal(isSinglePage({ mode: 'singlePage' }), true);
  assert.equal(isSinglePage({ scene: 1154 }), true);
  assert.equal(isSinglePage({ mode: 'default', scene: 1154 }), false);
  assert.equal(isSinglePage({ scene: 1007 }), false);
});

for (const options of [{ mode: 'singlePage', scene: 1154 }, { scene: 1154 }]) {
  test(`timeline startup and all shareable pages avoid cloud, storage and popups: ${JSON.stringify(options)}`, async () => {
    const r = runtime(options);
    await r.app().profileReady;
    for (const route of ['index/index', 'team/detail', 'mine/mine', 'publish/publish', 'game/game']) {
      const p = r.page(route);
      if (p.onLoad) p.onLoad(route === 'game/game' ? { g: 'cs2' } : { id: 'team-123' });
      await p.onShow();
      if (p.onPullDownRefresh) await p.onPullDownRefresh();
      assert.equal(p.data.singlePage, true);
      if (route === 'team/detail') assert.equal(p.data.teamId, 'team-123');
    }
    const c = r.welcome();
    c.lifetimes.attached.call(c);
    c.pageLifetimes.show.call(c);
    assert.equal(c.data.show, false);
    assert.deepEqual(r.calls, []);
  });
}

test('full mini program still initializes cloud, loads teams and shows welcome', async () => {
  const r = runtime({ mode: 'default', scene: 1007 });
  await r.app().profileReady;
  const p = r.page('index/index');
  await p.onShow();
  await p.loadList();
  assert.equal(p.data.singlePage, false);
  const c = r.welcome();
  c.lifetimes.attached.call(c);
  assert.equal(c.data.show, true);
  assert.ok(r.calls.includes('init'));
  assert.ok(r.calls.includes('getProfile'));
  assert.ok(r.calls.includes('listTeams'));
  assert.ok(!r.calls.includes('toast'));
});
