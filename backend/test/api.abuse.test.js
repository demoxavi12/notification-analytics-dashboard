// API abuse / input-security tests: operator injection, regex abuse, malformed ids,
// pagination/sorting abuse, mass assignment, cross-user access, payload limits,
// error leakage, ReDoS and cache-key isolation. Real app + in-memory MongoDB; the
// cache section uses the MOCK Redis client from fakeRedis.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, tokenFor, request } = require('./helpers');
const { FakeRedis } = require('./fakeRedis');
const { initRedis, closeRedis } = require('../src/config/redis');
const { setCacheLogger, resetCacheState, CACHE_PREFIX } = require('../src/middleware/cache');

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Notification = require('../src/models/Notification');

const quiet = { log: () => {}, warn: () => {}, error: () => {} };
let fake;
let alice;
let bob;
let admin;
let tokens;
let bobNotification;
let bobEvent;
let baseUrl;

before(async () => {
  baseUrl = await start();
  fake = new FakeRedis();
  initRedis({ client: fake, log: quiet });
  setCacheLogger(quiet);
  [alice, bob, admin] = await User.create([
    { name: 'Alice Abuse', email: 'alice.abuse@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob Abuse', email: 'bob.abuse@test.local', password: 'Password123!', role: 'user' },
    { name: 'Admin Abuse', email: 'admin.abuse@test.local', password: 'Password123!', role: 'admin' },
  ]);
  tokens = { alice: tokenFor(alice), bob: tokenFor(bob), admin: tokenFor(admin) };

  const now = Date.now();
  await Event.insertMany(
    Array.from({ length: 30 }, (_, i) => ({
      eventType: `payment.success`,
      service: 'payment-service',
      source: 'stripe',
      status: 'success',
      userId: i % 2 ? alice._id : bob._id,
      timestamp: new Date(now - i * 60000),
    }))
  );
  bobEvent = await Event.findOne({ userId: bob._id });
  await Notification.insertMany(
    Array.from({ length: 12 }, (_, i) => ({
      recipient: i % 2 ? alice._id : bob._id,
      title: `Note ${i}`,
      message: 'Body text',
      status: 'delivered',
    }))
  );
  bobNotification = await Notification.findOne({ recipient: bob._id });
});

after(async () => {
  await closeRedis();
  await stop();
});

const as = (who) => ({ token: tokens[who] });

// ---- 1. NoSQL operator injection ------------------------------------------------

test('login rejects operator objects and arrays instead of querying with them', async () => {
  const payloads = [
    { email: { $ne: null }, password: { $ne: null } },
    { email: { $gt: '' }, password: 'Password123!' },
    { email: { $regex: '.*' }, password: 'Password123!' },
    { email: ['alice.abuse@test.local'], password: 'Password123!' },
    { email: 'alice.abuse@test.local', password: { $ne: 'x' } },
  ];
  for (const body of payloads) {
    const res = await request('POST', '/auth/login', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.data, undefined, 'no token issued');
  }
});

test('register rejects non-string fields', async () => {
  for (const body of [
    { name: 'X Y', email: { $ne: null }, password: 'Password123!' },
    { name: { $gt: '' }, email: 'n1@test.local', password: 'Password123!' },
    { name: 'X Y', email: 'n2@test.local', password: ['Password123!'] },
  ]) {
    const res = await request('POST', '/auth/register', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('array / repeated query filters cannot widen or break list queries', async () => {
  const res = await request('GET', '/notifications?status=delivered&status=failed&type=info&type=error&read=true&read=false', as('alice'));
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((n) => n.recipient._id === String(alice._id)), 'still scoped to the caller');

  const events = await request('GET', '/events?service=payment-service&service=system&status=a&status=b', as('alice'));
  assert.equal(events.status, 200);
  assert.ok(events.body.data.every((e) => e.userId === null || e.userId._id === String(alice._id)));
});

test('admin recipient filter only accepts a valid ObjectId', async () => {
  for (const q of ['recipient=abc', 'recipient=1&recipient=2', `recipient=${encodeURIComponent('{"$ne":null}')}`]) {
    const res = await request('GET', `/notifications?${q}`, as('admin'));
    assert.equal(res.status, 400, q);
    assert.equal(res.body.error.code, 'INVALID_ID_FORMAT');
  }
  const ok = await request('GET', `/notifications?recipient=${bob._id}`, as('admin'));
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.every((n) => n.recipient._id === String(bob._id)));
});

test('event write fields reject operator objects', async () => {
  for (const extra of [{ eventType: { $ne: null } }, { source: { $gt: '' } }, { status: { $ne: 'x' } }, { service: { $in: ['system'] } }]) {
    const res = await request('POST', '/events', { ...as('alice'), body: { eventType: 'x', service: 'system', ...extra } });
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
});

// ---- 2/14. Regex / search abuse ---------------------------------------------------

test('search is literal, bounded and safe for regex metacharacters', async () => {
  for (const path of ['/events', '/notifications', '/users']) {
    const who = path === '/users' ? 'admin' : 'alice';
    for (const term of ['.*', '(a+)+$', '[', '\\', '^$|.*']) {
      const res = await request('GET', `${path}?search=${encodeURIComponent(term)}`, as(who));
      assert.equal(res.status, 200, `${path} ${term}`);
      assert.equal(res.body.data.length, 0, `${path}: "${term}" is matched literally`);
    }
    const started = Date.now();
    const long = await request('GET', `${path}?search=${'a'.repeat(5000)}`, as(who));
    assert.equal(long.status, 200);
    assert.ok(Date.now() - started < 2000, 'long search input is bounded');
  }
});

// ---- 3. Malformed ids --------------------------------------------------------------

test('malformed ids are rejected with 400, never 500', async () => {
  const cases = [
    ['GET', '/events/not-an-id', 'alice'],
    ['GET', `/events/${encodeURIComponent('{"$ne":null}')}`, 'alice'],
    ['PATCH', '/notifications/123/read', 'alice'],
    ['DELETE', '/notifications/zzz', 'alice'],
    ['GET', '/users/xyz', 'admin'],
    ['PATCH', '/users/xyz/role', 'admin'],
  ];
  for (const [method, path, who] of cases) {
    const res = await request(method, path, { ...as(who), body: method === 'PATCH' && path.includes('role') ? { role: 'user' } : undefined });
    assert.equal(res.status, 400, `${method} ${path}`);
    assert.equal(res.body.error.code, 'INVALID_ID_FORMAT');
  }
});

// ---- 4-7. Pagination / sorting -----------------------------------------------------

test('pagination clamps or defaults every abusive value (events, notifications, users)', async () => {
  const cases = [
    ['', 1, null],
    ['page=0&limit=0', 1, null],
    ['page=-5&limit=-10', 1, null],
    ['page=1.5&limit=2.5', 1, null],
    ['page=abc&limit=NaN', 1, null],
    ['page=Infinity&limit=1e9', 1, null],
    ['page=1&page=2&limit=5&limit=50', 1, null],
    ['limit=1000000', 1, 100],
    ['page=99999999999999999999', 10000, null],
  ];
  for (const [path, who] of [['/events', 'alice'], ['/notifications', 'alice'], ['/users', 'admin']]) {
    for (const [q, expectedPage, expectedLimit] of cases) {
      const res = await request('GET', `${path}?${q}`, as(who));
      assert.equal(res.status, 200, `${path}?${q}`);
      assert.equal(res.body.pagination.page, expectedPage, `${path}?${q} page`);
      assert.ok(res.body.pagination.limit >= 1 && res.body.pagination.limit <= 100, `${path}?${q} limit`);
      if (expectedLimit) assert.equal(res.body.pagination.limit, expectedLimit);
      assert.ok(res.body.data.length <= 100);
    }
  }
});

test('client-supplied sorting is ignored (no field/operator injection via sort)', async () => {
  const baseline = await request('GET', '/events?limit=10', as('alice'));
  for (const q of ['sort=-password', 'sort[$where]=1', 'sortBy=userId&order=asc', `sort=${encodeURIComponent('{"$natural":1}')}`]) {
    const res = await request('GET', `/events?limit=10&${q}`, as('alice'));
    assert.equal(res.status, 200, q);
    assert.deepEqual(res.body.data.map((e) => e._id), baseline.body.data.map((e) => e._id), q);
  }
});

test('invalid date filters are rejected', async () => {
  const res = await request('GET', '/events?startDate=not-a-date', as('alice'));
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_DATE');
});

// ---- 8. Mass assignment -------------------------------------------------------------

test('updates only touch the intended field', async () => {
  const target = await User.create({ name: 'Mass Target', email: 'mass@test.local', password: 'Password123!' });
  const res = await request('PATCH', `/users/${target._id}/role`, {
    ...as('admin'),
    body: { role: 'user', email: 'hijack@test.local', password: 'x', status: 'suspended', name: 'Renamed' },
  });
  assert.equal(res.status, 200);
  const stored = await User.findById(target._id).select('+password').lean();
  assert.equal(stored.email, 'mass@test.local');
  assert.equal(stored.name, 'Mass Target');
  assert.equal(stored.status, 'active');

  const note = await Notification.create({ recipient: alice._id, title: 't', message: 'm' });
  await request('PATCH', `/notifications/${note._id}/read`, { ...as('alice'), body: { read: false, recipient: String(bob._id), title: 'changed' } });
  const after = await Notification.findById(note._id).lean();
  assert.equal(after.read, true);
  assert.equal(String(after.recipient), String(alice._id));
  assert.equal(after.title, 't');
});

// ---- 9-12. Object-level authorization -----------------------------------------------

test('a user cannot read, modify or delete another user\'s resources', async () => {
  assert.equal((await request('GET', `/events/${bobEvent._id}`, as('alice'))).status, 404);
  assert.equal((await request('PATCH', `/notifications/${bobNotification._id}/read`, as('alice'))).status, 404);
  assert.equal((await request('DELETE', `/notifications/${bobNotification._id}`, as('alice'))).status, 404);
  const still = await Notification.findById(bobNotification._id).lean();
  assert.ok(still, 'not deleted');
  assert.equal(still.read, false, 'not modified');

  assert.equal((await request('GET', `/users/${bob._id}`, as('alice'))).status, 403);
  assert.equal((await request('PATCH', `/users/${bob._id}/status`, { ...as('alice'), body: { status: 'suspended' } })).status, 403);
  assert.equal((await User.findById(bob._id)).status, 'active');

  // Admins keep full access.
  assert.equal((await request('GET', `/events/${bobEvent._id}`, as('admin'))).status, 200);
  assert.equal((await request('GET', `/users/${bob._id}`, as('admin'))).status, 200);
});

test('analytics and stats require authentication and stay scoped', async () => {
  for (const path of ['/analytics/overview', '/analytics/timeseries', '/analytics/distributions', '/events/stats', '/notifications/stats']) {
    assert.equal((await request('GET', path)).status, 401, path);
  }
  const mine = await request('GET', '/notifications/stats', as('alice'));
  const all = await request('GET', '/notifications/stats', as('admin'));
  assert.equal(mine.body.data.total, await Notification.countDocuments({ recipient: alice._id }));
  assert.ok(all.body.data.total > mine.body.data.total);
});

// ---- 13. Oversized / malformed payloads ----------------------------------------------

test('field limits are enforced on writes', async () => {
  const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
  const eventCases = [
    { eventType: 'x'.repeat(101) },
    { source: 's'.repeat(101) },
    { metadata: { blob: 'x'.repeat(17 * 1024) } },
    { metadata: deep },
    { metadata: { $where: 'sleep(1000)' } },
    { metadata: { 'a.b': 1 } },
    { metadata: ['not', 'an', 'object'] },
    { metadata: 'string' },
  ];
  for (const extra of eventCases) {
    const res = await request('POST', '/events', { ...as('alice'), body: { eventType: 'ok', service: 'system', ...extra } });
    assert.equal(res.status, 400, JSON.stringify(extra).slice(0, 60));
  }
  const fine = await request('POST', '/events', {
    ...as('alice'),
    body: { eventType: 'ok', service: 'system', metadata: { amount: 99, nested: { a: { b: 1 } }, tags: ['x'] } },
  });
  assert.equal(fine.status, 201, 'flexible metadata still accepted');

  for (const extra of [{ title: 't'.repeat(201) }, { message: 'm'.repeat(2001) }, { type: 'critical' }, { channel: 'sms' }, { metadata: { $gt: 1 } }]) {
    const res = await request('POST', '/notifications', { ...as('alice'), body: { title: 'ok', message: 'ok', ...extra } });
    assert.equal(res.status, 400, JSON.stringify(extra).slice(0, 60));
  }

  for (const body of [
    { name: 'n'.repeat(101), email: 'long1@test.local', password: 'Password123!' },
    { name: 'Long Email', email: `${'e'.repeat(250)}@test.local`, password: 'Password123!' },
    { name: 'Long Pass', email: 'long3@test.local', password: 'P1!'.repeat(50) },
  ]) {
    assert.equal((await request('POST', '/auth/register', { body })).status, 400);
  }
});

test('oversized and malformed bodies get controlled 413/400 responses', async () => {
  const big = await request('POST', '/events', {
    ...as('alice'),
    body: { eventType: 'x', service: 'system', metadata: { blob: 'x'.repeat(200 * 1024) } },
  });
  assert.equal(big.status, 413);
  assert.equal(big.body.error.code, 'PAYLOAD_TOO_LARGE');

  const malformed = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.alice}` },
    body: '{"eventType": "x", "service": ',
  });
  const body = await malformed.json();
  assert.equal(malformed.status, 400);
  assert.deepEqual(body.error, { message: 'Request body is not valid JSON', code: 'INVALID_JSON' });
});

test('registration email validation is linear-time (ReDoS regression)', async () => {
  const started = Date.now();
  const res = await request('POST', '/auth/register', {
    body: { name: 'Re Dos', email: `${'a'.repeat(40)}!`, password: 'Password123!' },
  });
  assert.equal(res.status, 400);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started}ms`);
  assert.ok(!User.EMAIL_PATTERN.test(`${'a'.repeat(40)}!`));

  const t = Date.now();
  User.EMAIL_PATTERN.test(`${'a'.repeat(100000)}!`);
  User.EMAIL_PATTERN.test(`a@${'a.'.repeat(50000)}!`);
  assert.ok(Date.now() - t < 200, 'pattern stays fast on pathological input');
});

// ---- 16. Error information leakage ---------------------------------------------------

test('unexpected errors return a generic 500 without internals', async () => {
  const original = Event.countDocuments;
  Event.countDocuments = () => {
    const err = new Error('connect failed mongodb://dbadmin:S3cret@10.0.0.5:27017 at C:\\srv\\app\\node_modules\\x.js');
    err.code = 'ECONNREFUSED_FAKE';
    throw err;
  };
  try {
    const res = await request('GET', '/events/stats', as('bob'));
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, error: { message: 'Internal Server Error', code: 'SERVER_ERROR' } });
  } finally {
    Event.countDocuments = original;
  }
});

test('404s and parser errors do not echo input', async () => {
  const notFound = await request('GET', '/nope?token=secret-token-value', as('alice'));
  assert.equal(notFound.status, 404);
  assert.ok(!JSON.stringify(notFound.body).includes('secret-token-value'));
});

// ---- 17. Cache-key / input isolation ---------------------------------------------------

test('junk analytics parameters are rejected and never create cache keys', async () => {
  resetCacheState();
  fake.store.clear();
  for (let i = 0; i < 25; i += 1) {
    const res = await request('GET', `/analytics/overview?range=junk${i}`, as('alice'));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_QUERY');
  }
  for (const q of ['service=evil', 'service=a&service=b', 'range=24h&range=7d']) {
    assert.equal((await request('GET', `/analytics/timeseries?${q}`, as('alice'))).status, 400, q);
  }
  assert.equal(fake.store.size, 0, 'no keys from invalid input');

  await request('GET', '/analytics/overview?range=7d&service=payment-service', as('alice'));
  await request('GET', '/analytics/overview?range=7d&service=payment-service&role=admin&scope=admin', as('alice'));
  const keys = [...fake.store.keys()];
  assert.equal(keys.length, 1, 'extra params (role/scope) neither add keys nor change scope');
  assert.ok(keys[0].startsWith(`${CACHE_PREFIX}:user:${alice._id}:`));
});
