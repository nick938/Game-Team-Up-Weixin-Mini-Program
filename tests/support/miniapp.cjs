// Execute the actual Vue SFC setup with Vue reactivity; only host APIs and network are replaced.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const appRequire = createRequire(path.resolve(__dirname, '../../apps/miniapp/package.json'));
const ts = appRequire('typescript');
const { parse, compileScript } = appRequire('@vue/compiler-sfc');
const vue = appRequire('vue');
const sourceRoot = path.resolve(__dirname, '../../apps/miniapp/src');

function harness(options = {}) {
  const calls = [], toasts = [], emitted = [], storage = new Map(), navigation = [];
  const store = { user: null, isAdmin: false, isOrganizer: false, session: null, env: 'test', ...options.store };
  const application = { globalData: store, profileReady: Promise.resolve() };
  const target = options.target || 'mp-weixin';
  const platform = {
    showToast: value => toasts.push(value.title), showLoading() {}, hideLoading() {},
    navigateTo: value => navigation.push(value.url), switchTab: value => navigation.push(value.url),
    navigateBack() {}, setNavigationBarTitle() {}, stopPullDownRefresh() {}, hideTabBar() {}, showTabBar() {},
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    getLaunchOptionsSync: () => options.launch || {}, getEnterOptionsSync: () => options.launch || {},
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop', version: '' } }),
    getSystemInfoSync: () => ({ platform: 'test' }),
    ...options.platform,
  };
  const callTeam = async (action, input = {}) => {
    calls.push({ action, input });
    if (options.callTeam) return options.callTeam(action, input);
    return { ok: true, user: store.user, list: [], hosted: [], joined: [] };
  };
  const showError = error => toasts.push(error.message);
  const overrides = {
    'platform/host': { platform, buildTarget: target, capabilities: { wechatCloud: target === 'mp-weixin', wechatSubscription: target === 'mp-weixin' }, chooseAvatar: options.chooseAvatar },
    'platform/wechat': { wechatCloud: () => ({ init() { calls.push({ action: 'cloud.init' }); } }) },
    'utils/cloud': { callTeam, showError },
    'api/team': { callTeam, showError, uploadAvatar: options.uploadAvatar },
    'utils/subscribe': { requestTeamNotify: options.requestTeamNotify || (async () => false) },
    'stores/app': { useAppStore: () => store, getApplication: () => application, setProfileReady: value => { application.profileReady = value; } },
    ...options.overrides,
  };
  const cache = new Map();
  let activeHooks;
  function load(name, props = {}) {
    name = name.replaceAll('\\', '/').replace(/\.(js|ts|vue)$/, '');
    if (overrides[name]) return overrides[name];
    if (cache.has(name)) return cache.get(name);
    const file = ['.vue', '.ts', '.js'].map(ext => path.join(sourceRoot, name + ext)).find(fs.existsSync);
    if (!file) throw new Error('module not found: ' + name);
    let source = fs.readFileSync(file, 'utf8');
    const isVue = file.endsWith('.vue');
    if (isVue) {
      const { descriptor } = parse(source, { filename: file });
      source = compileScript(descriptor, { id: name }).content;
    }
    source = source.replace(/import ['"]virtual:uno.css['"];?/g, '').replace(/import\.meta\.env/g, '({})');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { allowJs: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } });
    const module = { exports: {} };
    const localRequire = specifier => {
      if (specifier === 'vue') return { ...vue, onMounted: callback => { activeHooks.mounted = callback; } };
      if (specifier === '@dcloudio/uni-app') return new Proxy({}, { get: (_, hook) => callback => { activeHooks[hook] = callback; } });
      if (!specifier.startsWith('.')) return appRequire(specifier);
      return load(path.relative(sourceRoot, path.resolve(path.dirname(file), specifier)));
    };
    const execute = vm.runInThisContext(`(function(require, module, exports, uni, __BUILD_TARGET__) { ${outputText}\n})`, { filename: file });
    execute(localRequire, module, module.exports, { ...platform, compressImage: ({ src, success }) => success({ tempFilePath: src }), ...options.uni }, target);
    if (!isVue) { cache.set(name, module.exports); return module.exports; }
    const hooks = {}, previousHooks = activeHooks;
    activeHooks = hooks;
    const bindings = module.exports.default.setup(vue.reactive(props), { expose() {}, emit: (name, detail) => emitted.push({ name, detail }) });
    activeHooks = previousHooks;
    const page = vue.proxyRefs(bindings);
    return { ...page, state: bindings.state, bindings, hooks, view: page };
  }
  return { load, page: load, calls, toasts, emitted, store, navigation, storage, platform, application };
}
module.exports = { harness };
