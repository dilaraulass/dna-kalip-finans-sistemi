import test from 'node:test';
import assert from 'node:assert/strict';
import { csrfFetch } from './csrfFetch.js';

test('safe methods do not request a token', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return new Response(); });
  for (const method of ['GET', 'HEAD', 'OPTIONS']) await csrfFetch('/api/test', { method });
  assert.deepEqual(calls, ['/api/test', '/api/test', '/api/test']);
});

test('all write methods receive fresh tokens and preserve payload, headers and signal', async t => {
  let tokens = 0;
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/csrf') {
      assert.equal(options.cache, 'no-store');
      return Response.json({ token: `token-${++tokens}` });
    }
    assert.equal(options.headers.get('X-CSRF-TOKEN'), `token-${tokens}`);
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.body, '{"amount":10}');
    assert.equal(options.signal, signal);
    assert.equal(options.credentials, 'include');
    return new Response(null, { status: 204 });
  });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
    await csrfFetch('/api/test', { method, signal, body: '{"amount":10}', headers: { 'Content-Type': 'application/json' } });
  assert.equal(tokens, 4);
});

test('concurrent writes share initial token request only', async t => {
  let tokens = 0;
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/csrf') { tokens++; return Response.json({ token: 'shared' }); }
    writes++; return new Response();
  });
  await Promise.all([csrfFetch('/api/a', { method: 'POST' }), csrfFetch('/api/b', { method: 'POST' })]);
  assert.equal(tokens, 1);
  assert.equal(writes, 2);
  await csrfFetch('/api/auth/logout', { method: 'POST' });
  assert.equal(tokens, 2);
});

test('token failure prevents writes and next attempt can recover', async t => {
  let attempts = 0;
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/csrf') return ++attempts === 1 ? new Response(null, { status: 500 }) : Response.json({ token: 'ok' });
    writes++; return new Response();
  });
  await assert.rejects(csrfFetch('/api/test', { method: 'POST' }), /Güvenlik/);
  assert.equal(writes, 0);
  await csrfFetch('/api/test', { method: 'POST' });
  assert.equal(writes, 1);
});

test('malformed token response prevents a write', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return Response.json({}); });
  await assert.rejects(csrfFetch('/api/test', { method: 'POST' }), /Güvenlik/);
  assert.deepEqual(calls, ['/api/auth/csrf']);
});

test('aborting during token acquisition prevents mutation', async t => {
  const controller = new AbortController();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url); controller.abort(); return Response.json({ token: 'ok' });
  });
  await assert.rejects(csrfFetch('/api/test', { method: 'POST', signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(calls, ['/api/auth/csrf']);
});

test('CSRF rejection is not automatically replayed', async t => {
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/csrf') return Response.json({ token: 'ok' });
    writes++; return Response.json({ code: 'csrf_validation_failed' }, { status: 403 });
  });
  assert.equal((await csrfFetch('/api/test', { method: 'POST' })).status, 403);
  assert.equal(writes, 1);
});

test('external URLs cannot receive tokens', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not fetch'));
  for (const url of ['https://example.org/api/test', '//example.org/api/test', '/api/\\example.org'])
    await assert.rejects(csrfFetch(url, { method: 'POST' }), /Geçersiz/);
});
