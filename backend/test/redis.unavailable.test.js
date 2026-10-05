// Redis unavailable / not configured, using the REAL ioredis client (no mock): the
// client points at a closed local port, so every connection attempt is refused.
// This exercises the genuine error/reconnect path, not a live Redis server.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { start, stop, tokenFor, request } = require('./helpers');

const {
  initRedis,
  closeRedis,
  getRedisStatus,
  getRedisClient,
  redactRedisUrl,
  resolveRedisUrl,
  retryDelayMs,
} = require('../src/config/redis');
const {
  CACHE_PREFIX,
  MEMORY_MAX_ENTRIES,
  readCache,
  writeCache,
  resetCacheState,
  setCacheLogger,
} = require('../src/middleware/cache');
const User = require('../src/models/User');

const REDIS_PASSWORD = 'S3cret-redis-pw';
const UNREACHABLE_REDIS = `redis://default:${REDIS_PASSWORD}@127.0.0.1:1`;

const logs = [];
const captureLogger = {
  log: (msg) => logs.push(String(msg)),
  warn: (msg) => logs.push(String(msg)),
  error: (msg) => logs.push(String(msg)),
};

const waitFor = async (predicate, timeoutMs = 10000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

let token;

before(async () => {
  await start();
  const user = await User.create({ name: 'Una Vailable', email: 'una@test.local', password: 'Password123!' });
  token = tokenFor(user);
});

after(async () => {
  await closeRedis();
  await stop();
});

test('URL resolution per environment', () => {
  assert.equal(resolveRedisUrl({ NODE_ENV: 'production' }), null, 'production needs explicit REDIS_URL');
  assert.equal(resolveRedisUrl({ NODE_ENV: 'test' }), null, 'tests never touch a local Redis implicitly');
  assert.equal(resolveRedisUrl({ NODE_ENV: 'development' }), 'redis://localhost:6379');
  assert.equal(resolveRedisUrl({}), 'redis://localhost:6379');
  assert.equal(resolveRedisUrl({ NODE_ENV: 'production', REDIS_URL: ' rediss://cache.example:6380 ' }), 'rediss://cache.example:6380');
});

test('credentials are redacted from URLs and error text', () => {
  assert.equal(redactRedisUrl('redis://user:pw@host:6379/0'), 'redis://***@host:6379/0');
  assert.equal(redactRedisUrl('rediss://:pw@host:6380?tls=true&password=x'), 'rediss://***@host:6380');
  assert.equal(
    redactRedisUrl('Error connecting to redis://default:pw@10.0.0.1:6379 (ECONNREFUSED)'),
    'Error connecting to redis://***@10.0.0.1:6379 (ECONNREFUSED)'
  );
});

test('reconnect backoff never gives up and is capped', () => {
  const delays = Array.from({ length: 50 }, (_, i) => retryDelayMs(i + 1));
  assert.ok(delays.every((d) => typeof d === 'number' && d > 0), 'never returns null (which would stop reconnecting)');
  assert.ok(delays.every((d, i) => i === 0 || d >= delays[i - 1]), 'non-decreasing');
  assert.equal(Math.max(...delays), 10000);
});

test('no Redis configured: status "disabled", cache served from memory', async () => {
  assert.equal(initRedis({ env: { NODE_ENV: 'test' } }), null);
  assert.equal(getRedisStatus(), 'disabled');

  const health = await request('GET', '/health');
  assert.equal(health.body.redis, 'disabled');
  assert.equal(health.body.cache, 'memory');

  resetCacheState();
  assert.equal((await request('GET', '/events/stats', { token })).headers.get('x-cache'), 'MISS');
  assert.equal((await request('GET', '/events/stats', { token })).headers.get('x-cache'), 'HIT');
});

test('memory fallback is bounded', async () => {
  resetCacheState();
  const body = { success: true, data: 1 };
  for (let i = 0; i <= MEMORY_MAX_ENTRIES; i += 1) {
    await writeCache(`${CACHE_PREFIX}:admin:bound:${i}`, body, 60);
  }
  assert.equal(await readCache(`${CACHE_PREFIX}:admin:bound:0`), null, 'oldest entry evicted');
  assert.deepEqual(await readCache(`${CACHE_PREFIX}:admin:bound:${MEMORY_MAX_ENTRIES}`), body);
});

test('unreachable Redis (real ioredis client): API keeps working, nothing leaks', async () => {
  await closeRedis();
  resetCacheState();
  setCacheLogger(captureLogger);
  initRedis({ env: { NODE_ENV: 'development', REDIS_URL: UNREACHABLE_REDIS }, log: captureLogger });

  await waitFor(() => logs.some((line) => line.includes('[Redis] Unavailable')));
  assert.equal(getRedisStatus(), 'disconnected');
  assert.notEqual(getRedisClient().status, 'end', 'client keeps retrying in the background');

  const first = await request('GET', '/analytics/overview?range=7d', { token });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-cache'), 'MISS');
  assert.equal((await request('GET', '/analytics/overview?range=7d', { token })).headers.get('x-cache'), 'HIT');

  const simulated = await request('POST', '/events/simulate', { token, body: { serviceType: 'payment' } });
  assert.equal(simulated.status, 200, 'mutations (and their invalidation) work without Redis');
  assert.equal((await request('GET', '/analytics/overview?range=7d', { token })).headers.get('x-cache'), 'MISS');

  const health = await request('GET', '/health');
  assert.equal(health.body.redis, 'disconnected');
  assert.equal(health.body.cache, 'memory');

  // Let ioredis go through several reconnect attempts before counting log lines.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const unavailableLogs = logs.filter((line) => line.includes('[Redis] Unavailable'));
  assert.equal(unavailableLogs.length, 1, 'one log line per outage, not one per retry');
  assert.match(unavailableLogs[0], /Unavailable at redis:\/\/\*\*\*@127\.0\.0\.1:1 \([^)]+\)/, 'redacted target and a non-empty reason');
  assert.ok(logs.every((line) => !line.includes(REDIS_PASSWORD)), 'password never logged');

  await closeRedis();
  assert.equal(getRedisStatus(), 'disabled');
});

test('production without REDIS_URL warns clearly; production never logs Redis credentials', () => {
  const run = (extraEnv) => {
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: crypto.randomBytes(48).toString('hex'),
        MONGODB_URI: 'mongodb://127.0.0.1:1/never',
        PORT: '0',
        REDIS_URL: '',
        ...extraEnv,
      },
      encoding: 'utf8',
      timeout: 30000,
    });
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  };

  const unset = run({});
  assert.equal(unset.status, 1, 'still exits because MongoDB is unavailable');
  assert.match(unset.output, /REDIS_URL is not set/);

  const withCredentials = run({ REDIS_URL: UNREACHABLE_REDIS });
  assert.ok(!withCredentials.output.includes(REDIS_PASSWORD), 'credentials never logged');
  assert.ok(!withCredentials.output.includes('REDIS_URL is not set'));
});
