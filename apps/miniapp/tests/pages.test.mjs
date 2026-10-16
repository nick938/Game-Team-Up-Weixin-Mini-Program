import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../src/', import.meta.url));

function harness() {
  const calls = [], toasts = [], emitted = [], cache = new Map();
  const platform = { showToast: value => toasts.push(value.title), showLoading() {}, hideLoading() {} };
  const overrides = {
    'platform/host': { platform, capabilities: { wechatSubscription: false } },
    'utils/cloud': { callTeam: async (action, input) => { calls.push({ action, input }); return { ok: true }; }, showError: error => toasts.push(error.message) },
    'utils/subscribe': { requestTeamNotify: async () => false },
    'stores/app': { getApplication: () => ({ globalData: {} }) },
  };
  function load(name) {
    name = name.replaceAll('\\', '/').replace(/\.(js|ts)$/, '');
    if (overrides[name]) return overrides[name];
    if (cache.has(name)) return cache.get(name);
    const file = ['.vue', '.ts', '.js'].map(ext => path.join(root, name + ext)).find(fs.existsSync);
    if (!file) throw new Error('module not found: ' + name);
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const { outputText } = ts.transpileModule(source, { compilerOptions: { allowJs: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
    const module = { exports: {} };
    const require = specifier => {
      if (specifier === 'vue') return { nextTick: callback => Promise.resolve().then(callback) };
      return load(path.relative(root, path.resolve(path.dirname(file), specifier)));
    };
    vm.runInNewContext(outputText, { module, exports: module.exports, require, console, Date, Promise, setTimeout, clearTimeout, __BUILD_TARGET__: 'mp-qq' }, { filename: file });
    cache.set(name, module.exports);
    return module.exports;
  }
  function page(name) {
    const options = load(name).default;
    const state = options.data?.() || {};
    const instance = { ...state, $data: state, $emit: (name, detail) => emitted.push({ name, detail }) };
    // Match Vue's direct exposure of reactive data fields on the instance.
    for (const key of Object.keys(state)) Object.defineProperty(instance, key, { get: () => state[key], set: value => { state[key] = value; }, configurable: true });
    for (const [key, method] of Object.entries(options.methods || {})) instance[key] = method.bind(instance);
    return instance;
  }
  return { page, load, calls, toasts, emitted };
}

test('migrated publish blocks empty join method before any write', async () => {
  const h = harness(), page = h.page('pages/publish/publish');
  Object.assign(page.$data, { gameName: 'CS2', roomNo: '   ' });
  await page.onSubmit();
  assert.equal(h.calls.length, 0);
  assert.equal(h.toasts.includes('请填写房间 / 加入方式'), true);
});

test('migrated mine switches hosted/joined and ongoing/history without legacy this.data', () => {
  const h = harness(), page = h.page('pages/mine/mine');
  Object.assign(page.$data, { hostedOngoing: [{ id: 'hosted' }], joinedPast: [{ id: 'past' }] });
  page.updateVisibleTeams();
  assert.equal(page.visibleTeams[0].id, 'hosted');
  page.pickTeamTab({ currentTarget: { dataset: { tab: 'joined' } } });
  page.pickPhase({ currentTarget: { dataset: { phase: 'Past' } } });
  assert.equal(page.visibleTeams[0].id, 'past');
});

test('dataset adapter preserves objects and numeric/boolean values across Vue events', () => {
  const h = harness();
  const { eventWithDataset } = h.load('utils/state');
  const host = { userId: 'u_test', nickName: '玩家' };
  const event = eventWithDataset({ detail: { value: true }, currentTarget: { dataset: { hours: '2' } } }, { hours: 2, host });
  assert.equal(event.currentTarget.dataset.hours, 2);
  assert.equal(event.currentTarget.dataset.host, host);
  assert.equal(event.detail.value, true);
});

test('team card emits the real team id to its parent as Vue event detail', () => {
  const h = harness(), card = h.page('components/team-card/index');
  card.team = { _id: 'team-id', gameName: 'CS2' };
  card.onTap();
  assert.equal(h.emitted.length, 1);
  assert.equal(h.emitted[0].name, 'open');
  assert.equal(h.emitted[0].detail.id, 'team-id');
});
