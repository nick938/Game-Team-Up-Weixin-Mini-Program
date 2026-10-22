const { test } = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../cloudfunctions/p0Health');

test('health returns only a constant service marker for stripped and preserved HTTP paths', async () => {
  for (const path of ['/', '/p0/health']) {
    const result = await main({ httpMethod: 'GET', path, body: 'do not echo', queryStringParameters: { token: 'private-token' }, headers: { Authorization: 'Bearer private-token' } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), { ok: true, service: 'game-team-p0', version: 'p0-health-v1' });
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.stringify(result).includes('private-token'), false);
    assert.equal(result.headers['Access-Control-Allow-Credentials'], undefined);
  }
});

test('health does not accept writes, business actions or timer impersonation', async () => {
  for (const httpMethod of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const result = await main({ httpMethod, path: '/p0/health' });
    assert.equal(result.statusCode, 405);
  }
  for (const fields of [{ type: 'joinTeam' }, { Type: 'Timer' }, { TriggerName: 'startRemind' }]) {
    assert.equal((await main({ httpMethod: 'GET', path: '/', ...fields })).statusCode, 400);
  }
  for (const event of [undefined, null, {}, { type: 'joinTeam' }]) {
    assert.equal((await main(event)).statusCode, 400);
  }
  assert.equal((await main({ httpMethod: 'GET', path: '/admin' })).statusCode, 404);
});

test('health HEAD has no body and CORS never reflects an arbitrary origin', async () => {
  const result = await main({ httpMethod: 'HEAD', path: '/', headers: { Origin: 'https://other.example' } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '');
  assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal((await main({ httpMethod: 'OPTIONS', headers: { Origin: 'https://other.example' } })).statusCode, 403);
});

test('only the local P0 preview gets a non-credentialed read preflight', async () => {
  const result = await main({ httpMethod: 'OPTIONS', path: '/p0/health', headers: { Origin: 'http://127.0.0.1:5187', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(result.statusCode, 204);
  assert.equal(result.body, '');
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:5187');
  const denied = await main({ httpMethod: 'OPTIONS', headers: { origin: 'http://127.0.0.1:5187', 'access-control-request-method': 'POST' } });
  assert.equal(denied.statusCode, 405);
});
