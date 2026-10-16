import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { createTeamClient, ApiError } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('WeChat uses native cloud without starting platform HTTP login', async () => {
  let externalCalls = 0;
  const client = createTeamClient({ target: 'mp-weixin', state: { session: null },
    request: async () => { externalCalls++; }, loginCode: async () => { externalCalls++; },
    nativeCall: async (action, input) => ({ ok: true, action, input }),
  });
  assert.equal((await client.call('getProfile')).action, 'getProfile');
  assert.equal(externalCalls, 0);
});

test('QQ exchanges host code once and sends only the resulting bearer session to business API', async () => {
  const requests = [], state = { session: null };
  let logins = 0;
  const client = createTeamClient({ target: 'mp-qq', state, loginCode: async () => { logins++; return 'one-time-code'; },
    request: async (path, body, token) => {
      requests.push({ path, body, token });
      return path === '/v1/auth/qq' ? { ok: true, accessToken: 'opaque-session', expiresAt: Date.now() + 3600000 } : { ok: true, list: [] };
    },
  });
  await Promise.all([client.call('listTeams'), client.call('myTeams')]);
  assert.equal(logins, 1);
  assert.deepEqual(requests[0], { path: '/v1/auth/qq', body: { code: 'one-time-code' }, token: undefined });
  assert.equal(requests.slice(1).every(request => request.token === 'opaque-session' && !('code' in request.body)), true);
  assert.equal(state.session.accessToken, 'opaque-session');
});

test('simultaneous same reads coalesce, completed reads are fetched again', async () => {
  let reads = 0;
  const client = createTeamClient({ target: 'mp-weixin', state: { session: null },
    nativeCall: async () => { reads++; return { ok: true }; },
  });
  await Promise.all([client.call('getTeam', { teamId: 't' }), client.call('getTeam', { teamId: 't' })]);
  assert.equal(reads, 1);
  await client.call('getTeam', { teamId: 't' });
  assert.equal(reads, 2);
});

test('expired server session is cleared without replaying a potentially successful write', async () => {
  const state = { session: { accessToken: 'expired', expiresAt: Date.now() + 3600000 } };
  let requests = 0;
  const client = createTeamClient({ target: 'mp-qq', state, loginCode: async () => { throw new Error('must not retry'); },
    request: async () => { requests++; throw new ApiError('expired', 'UNAUTHENTICATED'); },
  });
  await assert.rejects(client.call('joinTeam', { teamId: 't' }), { code: 'UNAUTHENTICATED' });
  assert.equal(state.session, null);
  assert.equal(requests, 1);
});

test('identity hashes, missing tokens and expired login responses do not become sessions', async () => {
  for (const response of [{ ok: true }, { ok: true, userId: 'u_fake' }, { ok: true, accessToken: 'token', expiresAt: Date.now() - 1 }]) {
    const state = { session: null };
    const client = createTeamClient({ target: 'mp-qq', state, loginCode: async () => 'code', request: async () => response });
    await assert.rejects(client.call('getProfile'), { code: 'INVALID_SESSION' });
    assert.equal(state.session, null);
  }
});

test('business permission failures retain their codes instead of becoming successful responses', async () => {
  const client = createTeamClient({ target: 'mp-weixin', state: { session: null }, nativeCall: async () => ({ ok: false, code: 'NEED_PROFILE', errMsg: '请填写资料' }) });
  await assert.rejects(client.call('createTeam', {}), { code: 'NEED_PROFILE', message: '请填写资料' });
});
