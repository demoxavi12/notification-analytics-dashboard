// Response-cache behaviour through the real Express app + MongoDB (in-memory server),
// with Redis replaced by the MOCK client in fakeRedis.js (no real Redis is available
// here). Covers keying/isolation, TTLs, invalidation, malformed data and outages.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { start, stop, tokenFor, request } = require('./helpers');
const { FakeRedis } = require('./fakeRedis');

const { initRedis, closeRedis } = require('../src/config/redis');
const {
  CACHE_PREFIX,
  CACHE_TTL_SECONDS,
  MAX_CACHED_BODY_BYTES,
  resetCacheState,
  setCacheLogger,
  writeCache,
  readCache,
} = require('../src/middleware/cache');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');

const logs = [];
const captureLogger = {
  log: (msg) => logs.push(String(msg)),
  warn: (msg) => logs.push(String(msg)),
  error: (msg) => logs.push(String(msg)),
};

let fake;
let alice;
let bob;
let admin;
let admin2;
let tokens;

const keysFor = (scope) => [...fake.store.keys()].filter((key) => key.startsWith(`${CACHE_PREFIX}:${scope}:`));
const get = (path, who) => request('GET', path, { token: tokens[who] });

before(async () => {
  await start();
  fake = new FakeRedis();
  initRedis({ client: fake, log: captureLogger });
  setCacheLogger(captureLogger);

  [alice, bob, admin, admin2] = await User.create([
    { name: 'Alice Cache', email: 'alice.cache@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob Cache', email: 'bob.cache@test.local', password: 'Password123!', role: 'user' },
    { name: 'Admin Cache', email: 'admin.cache@test.local', password: 'Password123!', role: 'admin' },
    { name: 'Admin Two', email: 'admin2.cache@test.local', password: 'Password123!', role: 'admin' },
  ]);
  tokens = { alice: tokenFor(alice), bob: tokenFor(bob), admin: tokenFor(admin), admin2: tokenFor(admin2) };
});

after(async () => {
  await closeRedis();
  await stop();
});

beforeEach(async () => {
  if (fake.status !== 'ready') fake.comeBack();
  fake.failing = false;
  fake.clockOffsetMs = 0;
  fake.store.clear();
  fake.calls.length = 0;
  resetCacheState();
  await Notification.deleteMany({});
  await Notification.create([
    { recipient: alice._id, title: 'A1', message: 'm', status: 'delivered' },
    { recipient: alice._id, title: 'A2', message: 'm', status: 'delivered' },
    { recipient: bob._id, title: 'B1', message: 'm', status: 'failed' },
  ]);
});

test('cache miss then hit, stored in Redis with the documented TTL', async () => {
  const first = await get('/analytics/overview?range=7d', 'alice');
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-cache'), 'MISS');

  const second = await get('/analytics/overview?range=7d', 'alice');
  assert.equal(second.headers.get('x-cache'), 'HIT');
  assert.deepEqual(second.body, first.body);

  const [key] = keysFor(`user:${alice._id}`);
  assert.ok(key, 'entry written to Redis');
  assert.equal(fake.ttl(key), CACHE_TTL_SECONDS.analytics);

  await get('/notifications/stats', 'alice');
  const statsKey = keysFor(`user:${alice._id}`).find((k) => k.includes(':notifications:stats:'));
  assert.equal(fake.ttl(statsKey), CACHE_TTL_SECONDS.stats);
});

test('entries expire after their TTL', async () => {
  await get('/notifications/stats', 'alice');
  assert.equal((await get('/notifications/stats', 'alice')).headers.get('x-cache'), 'HIT');
  fake.clockOffsetMs = (CACHE_TTL_SECONDS.stats + 1) * 1000;
  assert.equal((await get('/notifications/stats', 'alice')).headers.get('x-cache'), 'MISS');
});

test('users never receive each other\'s cached data', async () => {
  const aliceStats = await get('/notifications/stats', 'alice');
  const bobStats = await get('/notifications/stats', 'bob');
  assert.equal(bobStats.headers.get('x-cache'), 'MISS', 'bob must not hit alice\'s entry');
  assert.equal(aliceStats.body.data.total, 2);
  assert.equal(bobStats.body.data.total, 1);
  assert.equal(keysFor(`user:${alice._id}`).length, 1);
  assert.equal(keysFor(`user:${bob._id}`).length, 1);
});

test('admin and user views are cached separately; admins share the global view', async () => {
  const adminStats = await get('/notifications/stats', 'admin');
  assert.equal(adminStats.body.data.total, 3, 'admin sees all notifications');

  const userStats = await get('/notifications/stats', 'alice');
  assert.equal(userStats.headers.get('x-cache'), 'MISS');
  assert.equal(userStats.body.data.total, 2, 'user never gets the admin (global) response');

  const otherAdmin = await get('/notifications/stats', 'admin2');
  assert.equal(otherAdmin.headers.get('x-cache'), 'HIT', 'admin responses are identity-independent');
  assert.equal(keysFor('admin').length, 1);
});

test('declared query params separate keys; undeclared params cannot fragment the cache', async () => {
  await get('/analytics/overview?range=7d', 'alice');
  assert.equal((await get('/analytics/overview?range=24h', 'alice')).headers.get('x-cache'), 'MISS');
  assert.equal((await get('/analytics/overview?range=7d&service=payment-service', 'alice')).headers.get('x-cache'), 'MISS');
  assert.equal((await get('/analytics/overview?service=payment-service&range=7d', 'alice')).headers.get('x-cache'), 'HIT', 'param order is irrelevant');
  assert.equal((await get('/analytics/overview?range=7d&junk=1&x=y', 'alice')).headers.get('x-cache'), 'HIT', 'unknown params ignored');
  assert.equal((await get('/analytics/distributions?range=7d&service=payment-service', 'alice')).headers.get('x-cache'), 'MISS');
  assert.equal((await get('/analytics/distributions?range=7d', 'alice')).headers.get('x-cache'), 'HIT', 'distributions ignores service');
  assert.equal(keysFor(`user:${alice._id}`).length, 4);
});

test('cache keys contain no raw user input', async () => {
  await get(`/analytics/overview?range=${encodeURIComponent('*:evil\r\nFLUSHALL')}`, 'alice');
  for (const key of fake.store.keys()) {
    assert.match(key, /^pulseops:cache:v2:(admin|user:[a-f0-9]{24}):[a-z:]+:(none|[a-f0-9]{32})$/);
  }
});

test('a mutation invalidates the affected user and the admin view, not other users', async () => {
  await get('/notifications/stats', 'alice');
  await get('/notifications/stats', 'bob');
  await get('/notifications/stats', 'admin');

  const target = await Notification.findOne({ recipient: alice._id });
  const marked = await request('PATCH', `/notifications/${target._id}/read`, { token: tokens.alice });
  assert.equal(marked.status, 200);

  assert.equal(keysFor(`user:${alice._id}`).length, 0, 'alice scope invalidated');
  assert.equal(keysFor('admin').length, 0, 'admin view invalidated');
  assert.equal(keysFor(`user:${bob._id}`).length, 1, 'bob\'s cache untouched');

  const fresh = await get('/notifications/stats', 'alice');
  assert.equal(fresh.headers.get('x-cache'), 'MISS');
  assert.equal(fresh.body.data.unread, 1, 'no stale unread count after mark-read');
  assert.equal((await get('/notifications/stats', 'bob')).headers.get('x-cache'), 'HIT');
});

test('mark-all-read, delete and event ingestion invalidate the caller\'s scope', async () => {
  await get('/notifications/stats', 'alice');
  await request('PATCH', '/notifications/read-all', { token: tokens.alice });
  assert.equal((await get('/notifications/stats', 'alice')).body.data.unread, 0);

  const target = await Notification.findOne({ recipient: alice._id });
  await request('DELETE', `/notifications/${target._id}`, { token: tokens.alice });
  assert.equal((await get('/notifications/stats', 'alice')).body.data.total, 1);

  const before = (await get('/events/stats', 'alice')).body.data.totalEvents;
  await request('POST', '/events/simulate', { token: tokens.alice, body: { serviceType: 'payment' } });
  const after = await get('/events/stats', 'alice');
  assert.equal(after.headers.get('x-cache'), 'MISS');
  assert.equal(after.body.data.totalEvents, before + 1, 'events stats are invalidated (previously never were)');
});

test('an unowned system event invalidates every user scope', async () => {
  await get('/events/stats', 'alice');
  await get('/events/stats', 'bob');
  await request('POST', '/events/simulate', { token: tokens.admin, body: { serviceType: 'system' } });
  assert.equal(keysFor('user:').length, 0);
});

test('malformed or wrongly-shaped cache entries are discarded and recomputed', async () => {
  const miss = await get('/notifications/stats', 'alice');
  const [key] = keysFor(`user:${alice._id}`);

  for (const garbage of ['{not json', '"a string"', JSON.stringify({ success: false, data: { total: 999 } })]) {
    fake.store.set(key, { value: garbage, expiresAt: null });
    const res = await get('/notifications/stats', 'alice');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-cache'), 'MISS');
    assert.deepEqual(res.body.data, miss.body.data);
  }
  assert.ok(logs.some((line) => line.includes('malformed cache entry')));
});

test('Redis command failures never fail the request', async () => {
  fake.failing = true;
  const res = await get('/analytics/overview?range=7d', 'alice');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-cache'), 'MISS');

  const target = await Notification.findOne({ recipient: alice._id });
  const marked = await request('PATCH', `/notifications/${target._id}/read`, { token: tokens.alice });
  assert.equal(marked.status, 200, 'invalidation failure must not break the mutation');
});

test('outage: memory fallback + health degrade; recovery purges entries that went stale', async () => {
  await get('/notifications/stats', 'alice'); // cached in Redis: unread = 2
  const baseline = await request('GET', '/health');
  assert.equal(baseline.body.redis, 'connected');
  fake.goDown('connect ECONNREFUSED 10.0.0.9:6380 (redis://:hunter2@10.0.0.9:6380)');

  // Overall status/HTTP code follow MongoDB only (the harness connects Mongoose
  // directly, so compare against the baseline rather than a fixed value).
  const health = await request('GET', '/health');
  assert.equal(health.status, baseline.status, 'Redis loss must not change the health HTTP status');
  assert.equal(health.body.status, baseline.body.status);
  assert.equal(health.body.database, baseline.body.database);
  assert.equal(health.body.redis, 'disconnected');
  assert.equal(health.body.cache, 'memory');

  // Mutation during the outage cannot reach Redis.
  const target = await Notification.findOne({ recipient: alice._id });
  await request('PATCH', `/notifications/${target._id}/read`, { token: tokens.alice });
  const during = await get('/notifications/stats', 'alice');
  assert.equal(during.status, 200);
  assert.equal(during.body.data.unread, 1);
  assert.equal((await get('/notifications/stats', 'alice')).headers.get('x-cache'), 'HIT', 'memory fallback caches');

  fake.comeBack();
  const recovered = await request('GET', '/health');
  assert.equal(recovered.body.redis, 'connected');
  assert.equal(recovered.body.cache, 'redis');

  const after = await get('/notifications/stats', 'alice');
  assert.equal(after.body.data.unread, 1, 'pre-outage Redis entry must not be served after recovery');
  assert.ok(logs.every((line) => !line.includes('hunter2')), 'credentials never logged');
  assert.ok(logs.some((line) => line.includes('redis://***@10.0.0.9')), 'URL is redacted, not dropped');
});

test('auth failures and non-GET requests are never cached', async () => {
  const anon = await request('GET', '/analytics/overview');
  assert.equal(anon.status, 401);
  await request('POST', '/notifications', { token: tokens.alice, body: { title: 't', message: 'm' } });
  assert.equal(fake.calls.includes('set'), false);
  assert.equal(fake.store.size, 0);
});

test('oversized bodies are not cached', async () => {
  const huge = { success: true, data: 'x'.repeat(MAX_CACHED_BODY_BYTES + 1) };
  assert.equal(await writeCache(`${CACHE_PREFIX}:admin:test:none`, huge, 30), false);
  assert.equal(await readCache(`${CACHE_PREFIX}:admin:test:none`), null);
});

test('KEYS is never issued, and the source no longer uses it', () => {
  assert.equal(fake.calls.includes('keys'), false);
  const files = ['src/config/redis.js', 'src/middleware/cache.js'].map((f) =>
    fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
  );
  for (const source of files) {
    assert.ok(!/\.keys\(\s*['"`]|['"`]KEYS['"`]/.test(source), 'no Redis KEYS command');
  }
});

test('connection errors with an empty message are still described in the log', () => {
  logs.length = 0;
  const refused = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
  const aggregate = Object.assign(new AggregateError([refused, refused], ''), { code: 'ECONNREFUSED' });
  fake.status = 'reconnecting';
  fake.emit('error', aggregate);
  fake.emit('close');
  assert.ok(logs.some((line) => /\[Redis\] Unavailable at .+ \(ECONNREFUSED\)/.test(line)), logs.join('\n'));
});
