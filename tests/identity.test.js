const { test } = require('node:test');
const assert = require('node:assert/strict');
const { identityKey, createWechatIdentityResolver } = require('../cloudfunctions/team/lib/identity');

const appId = 'wx-test-app';
const subject = 'openid-server-verified';
const userId = 'u_0123456789abcdef0123456789abcdef';
const verified = { provider: 'weixin', appId, subject };
const linked = () => ({ ...verified, identityKey: identityKey(verified), userId });

test('identity keys separate providers, applications and ambiguous concatenations', () => {
  const keys = [
    identityKey(verified),
    identityKey({ ...verified, provider: 'qq' }),
    identityKey({ ...verified, appId: 'wx-another-app' }),
    identityKey({ provider: 'weixin', appId: 'ab', subject: 'c' }),
    identityKey({ provider: 'weixin', appId: 'a', subject: 'bc' }),
  ];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.some(key => key.includes(subject)), false);
});

test('currentActor ignores caller-supplied identities and never inherits mapping roles', async () => {
  const resolver = createWechatIdentityResolver({
    expectedAppId: appId,
    getTrustedContext(...args) {
      assert.equal(args.length, 0);
      return { APPID: appId, OPENID: subject };
    },
    async findIdentity(key) {
      assert.equal(key, identityKey(verified));
      return { ...linked(), isAdmin: true, roles: ['admin'] };
    },
  });
  const actor = await resolver.currentActor({ OPENID: 'attacker', userId: 'other', isAdmin: true });
  assert.deepEqual(actor, { userId, provider: 'weixin', appId, legacyOpenId: subject });
  assert.equal(Object.isFrozen(actor), true);
});

test('missing trusted context and wrong application are rejected before storage lookup', async () => {
  for (const context of [null, {}, { APPID: appId }, { APPID: appId, OPENID: ' ' }, { APPID: 'other-app', OPENID: subject }]) {
    let lookups = 0;
    const resolver = createWechatIdentityResolver({ expectedAppId: appId, getTrustedContext: () => context, findIdentity: async () => { lookups++; } });
    await assert.rejects(resolver.currentActor(), error => ['AUTH_CONTEXT_REQUIRED', 'APP_NOT_ALLOWED'].includes(error.code));
    assert.equal(lookups, 0);
  }
});

test('missing identity mapping is not auto-created or inferred from a nickname', async () => {
  const resolver = createWechatIdentityResolver({ expectedAppId: appId, getTrustedContext: () => ({ APPID: appId, OPENID: subject, nickname: 'same-name' }), findIdentity: async () => null });
  await assert.rejects(resolver.currentActor(), { code: 'IDENTITY_NOT_LINKED' });
});

test('conflicting mapping fields or legacy OpenID used as business userId fail closed', async () => {
  for (const patch of [{ identityKey: 'other' }, { provider: 'qq' }, { appId: 'other' }, { subject: 'other' }, { userId: subject }, { userId: '' }]) {
    const resolver = createWechatIdentityResolver({ expectedAppId: appId, getTrustedContext: () => ({ APPID: appId, OPENID: subject }), findIdentity: async () => ({ ...linked(), ...patch }) });
    await assert.rejects(resolver.currentActor(), { code: 'IDENTITY_CONFLICT' });
  }
});

test('lookup failure does not fall back to an unverified or newly invented user', async () => {
  const resolver = createWechatIdentityResolver({ expectedAppId: appId, getTrustedContext: () => ({ APPID: appId, OPENID: subject }), findIdentity: async () => { throw new Error('database-unavailable'); } });
  await assert.rejects(resolver.currentActor(), /database-unavailable/);
});
