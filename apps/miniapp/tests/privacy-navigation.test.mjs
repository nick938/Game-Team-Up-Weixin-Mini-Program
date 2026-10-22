import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { harness } = require('../../../tests/support/miniapp.cjs');

function privacyHarness() {
  const { createPrivacyConsent } = harness().load('utils/privacy');
  const consent = createPrivacyConsent();
  let listener;
  let query;
  let registered = 0;
  let opened = 0;
  const host = {
    onNeedPrivacyAuthorization(callback) {
      listener = callback;
      registered++;
    },
    getPrivacySetting(options) {
      query = options;
    },
    openPrivacyContract() {
      opened++;
    },
  };
  consent.initialize(host);
  return {
    consent,
    host,
    request: (resolve) => listener(resolve),
    result: (value) => query.success(value),
    get registered() {
      return registered;
    },
    get opened() {
      return opened;
    },
  };
}

test('privacy uses native authorization status and does not repeatedly prompt in one session', () => {
  const h = privacyHarness();
  h.consent.initialize(h.host);
  assert.equal(h.registered, 1);
  h.consent.check();
  h.result({ needAuthorization: false, privacyContractName: '《平台隐私指引》' });
  assert.equal(h.consent.state.visible, false);
  assert.equal(h.consent.state.contractName, '《平台隐私指引》');
  h.consent.openContract(() => assert.fail('should open native contract'));
  assert.equal(h.opened, 1);
});

test('agreement resolves every pending privacy call with the native button id', () => {
  const h = privacyHarness();
  const results = [];
  h.request((value) => results.push(value));
  h.request((value) => results.push(value));
  assert.equal(h.consent.state.visible, true);
  h.consent.agree();
  assert.deepEqual(results, Array(2).fill({ event: 'agree', buttonId: 'privacy-agree' }));
  assert.equal(h.consent.state.visible, false);
  h.consent.agree();
  assert.equal(results.length, 2);
});

test('rejection ends pending calls and a later privacy action can request again', () => {
  const h = privacyHarness();
  const results = [];
  h.consent.check();
  h.request((value) => results.push(value));
  h.consent.reject();
  h.result({ needAuthorization: true });
  assert.equal(h.consent.state.visible, false, 'late settings cannot reopen a refused sheet');
  assert.deepEqual(results, [{ event: 'disagree' }]);
  h.request((value) => results.push(value));
  assert.equal(h.consent.state.visible, true);
  h.consent.agree();
  assert.equal(results[1].event, 'agree');
});

test('a delayed settings response cannot hide a newer native privacy request', () => {
  const h = privacyHarness();
  h.consent.check();
  h.request(() => {});
  h.result({ needAuthorization: false });
  assert.equal(h.consent.state.visible, true);
});

test('unsupported hosts keep privacy UI inactive', () => {
  const { createPrivacyConsent } = harness().load('utils/privacy');
  const consent = createPrivacyConsent();
  consent.initialize({});
  consent.check();
  assert.equal(consent.state.visible, false);
});

test('welcome waits for privacy and resumes without being marked read', async () => {
  const h = harness();
  const welcome = h.page('components/welcome-letter/index', { enabled: false });
  welcome.hooks.mounted();
  assert.equal(welcome.state.show, false);
  assert.equal(h.storage.has('welcomeLetterV2'), false);
  welcome.bindings.props.enabled = true;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(welcome.state.show, true);
  welcome.bindings.props.enabled = false;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(welcome.state.show, false);
  assert.equal(h.storage.has('welcomeLetterV2'), false);
});

test('entry notices wait until the privacy closing animation has finished', () => {
  const h = harness();
  const { privacyConsent } = h.load('utils/privacy');
  const entry = h.page('components/entry-notices/index');
  privacyConsent.state.checking = true;
  assert.equal(entry.view.privacyReady, false);
  privacyConsent.state.checking = false;
  privacyConsent.state.visible = true;
  privacyConsent.agree();
  assert.equal(entry.view.privacyReady, false);
  privacyConsent.afterLeave();
  assert.equal(entry.view.privacyReady, true);
});

test('home navigation reserves status bar and capsule space across phone geometries', () => {
  const { homeNavigationMetrics } = harness().load('utils/home-navigation');
  assert.deepEqual(homeNavigationMetrics(44, 375, { top: 50, bottom: 82, height: 32, left: 278 }), {
    status: 44,
    height: 44,
    total: 88,
    right: 109,
  });
  assert.deepEqual(homeNavigationMetrics(24, 320, { top: 32, bottom: 64, height: 32, left: 223 }), {
    status: 24,
    height: 48,
    total: 72,
    right: 109,
  });
  assert.deepEqual(homeNavigationMetrics(0, 375, { top: 0, bottom: 0, height: 0, left: 0 }), {
    status: 0,
    height: 48,
    total: 48,
    right: 16,
  });
});
