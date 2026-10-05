// Rate limiting (in-process memory store; independent of Redis). The auth limit is
// lowered via env before the app is loaded so the test stays fast.
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
delete process.env.TRUST_PROXY;

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, tokenFor, request } = require('./helpers');
const { resolveTrustProxy } = require('../src/config/proxy');
const { positiveIntFromEnv } = require('../src/middleware/rateLimiter');
const { getRedisStatus } = require('../src/config/redis');
const User = require('../src/models/User');

let token;

before(async () => {
  await start();
  const user = await User.create({ name: 'Rate Tester', email: 'rate@test.local', password: 'Password123!' });
  token = tokenFor(user);
});

after(stop);

test('auth endpoints are limited per IP and report a bounded retry time', async () => {
  assert.equal(getRedisStatus(), 'disabled', 'limiting works with no Redis at all');
  const attempt = () => request('POST', '/auth/login', { body: { email: 'rate@test.local', password: 'wrong-password' } });

  for (let i = 0; i < 3; i += 1) assert.equal((await attempt()).status, 401);
  const blocked = await attempt();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'RATE_LIMIT_EXCEEDED');
  const retry = blocked.body.error.details.retryAfterSeconds;
  assert.ok(retry >= 1 && retry <= 60, `retryAfterSeconds within the window (got ${retry})`);

  // Registration shares the auth bucket.
  const register = await request('POST', '/auth/register', { body: { name: 'New Person', email: 'new@test.local', password: 'Password123!' } });
  assert.equal(register.status, 429);
});

test('spoofed X-Forwarded-For does not bypass the limit when no proxy is trusted', async () => {
  const spoofed = await request('POST', '/auth/login', {
    body: { email: 'rate@test.local', password: 'wrong-password' },
    headers: { 'X-Forwarded-For': '203.0.113.77' },
  });
  assert.equal(spoofed.status, 429);
});

test('event writes (ingest + simulate) use the stricter ingestion limiter', async () => {
  const read = await request('GET', '/events', { token });
  const simulate = await request('POST', '/events/simulate', { token, body: { serviceType: 'payment' } });
  const ingest = await request('POST', '/events', { token, body: { eventType: 'x.y', service: 'system' } });
  const generalLimit = Number(read.headers.get('ratelimit-limit'));
  assert.equal(Number(simulate.headers.get('ratelimit-limit')), Number(ingest.headers.get('ratelimit-limit')));
  assert.ok(Number(simulate.headers.get('ratelimit-limit')) < generalLimit, 'simulate is no longer only under the general limit');
});

test('TRUST_PROXY accepts only a positive hop count', () => {
  assert.equal(resolveTrustProxy(undefined), false);
  assert.equal(resolveTrustProxy(''), false);
  assert.equal(resolveTrustProxy('0'), false);
  assert.equal(resolveTrustProxy('true'), false, 'never trust arbitrary forwarding headers');
  assert.equal(resolveTrustProxy('-1'), false);
  assert.equal(resolveTrustProxy('1'), 1);
  assert.equal(resolveTrustProxy('2'), 2);
});

test('invalid limit env values fall back to safe defaults instead of disabling limits', () => {
  assert.equal(positiveIntFromEnv(undefined, 20), 20);
  assert.equal(positiveIntFromEnv('abc', 20), 20);
  assert.equal(positiveIntFromEnv('0', 20), 20);
  assert.equal(positiveIntFromEnv('-5', 20), 20);
  assert.equal(positiveIntFromEnv('50', 20), 50);
});
