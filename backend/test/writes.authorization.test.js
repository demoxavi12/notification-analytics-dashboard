// Ownership on writes: POST /events and POST /notifications must not let a normal
// user attribute data to another account. Admins may target any existing user (and
// create unowned system events). Redis is the MOCK client from fakeRedis.js so the
// cache-invalidation path on these writes is exercised too.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, tokenFor, request } = require('./helpers');
const { FakeRedis } = require('./fakeRedis');
const { initRedis, closeRedis } = require('../src/config/redis');
const { setCacheLogger } = require('../src/middleware/cache');

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Notification = require('../src/models/Notification');

const quietLogger = { log: () => {}, warn: () => {}, error: () => {} };
const MISSING_ID = '64b7f0c2a1b2c3d4e5f60718';

let alice;
let bob;
let admin;
let tokens;

before(async () => {
  await start();
  initRedis({ client: new FakeRedis(), log: quietLogger });
  setCacheLogger(quietLogger);
  [alice, bob, admin] = await User.create([
    { name: 'Alice Writer', email: 'alice.writes@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob Victim', email: 'bob.writes@test.local', password: 'Password123!', role: 'user' },
    { name: 'Admin Writer', email: 'admin.writes@test.local', password: 'Password123!', role: 'admin' },
  ]);
  tokens = { alice: tokenFor(alice), bob: tokenFor(bob), admin: tokenFor(admin) };
});

after(async () => {
  await closeRedis();
  await stop();
});

const ingest = (who, extra = {}) =>
  request('POST', '/events', {
    token: tokens[who],
    body: { eventType: 'payment.success', service: 'payment-service', ...extra },
  });

const notify = (who, extra = {}) =>
  request('POST', '/notifications', { token: tokens[who], body: { title: 'Hello', message: 'Body', ...extra } });

const ownerOf = (doc) => (doc.userId === null ? null : String(doc.userId));

// ---- Events -------------------------------------------------------------------

test('normal user ingesting without userId creates an event owned by themselves', async () => {
  const res = await ingest('alice');
  assert.equal(res.status, 201);
  assert.equal(ownerOf(res.body.data.event), String(alice._id));
});

test('normal user may pass their own userId explicitly', async () => {
  const res = await ingest('alice', { userId: String(alice._id) });
  assert.equal(res.status, 201);
  assert.equal(ownerOf(res.body.data.event), String(alice._id));
});

test('normal user cannot ingest an event attributed to another user (regression)', async () => {
  const before = await Event.countDocuments({ userId: bob._id });
  const statsBefore = await request('GET', '/events/stats', { token: tokens.bob });

  const res = await ingest('alice', { userId: String(bob._id), eventType: 'payment.failed', status: 'error' });
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'FORBIDDEN_TARGET_USER');

  assert.equal(await Event.countDocuments({ userId: bob._id }), before, 'no event written for the victim');
  const statsAfter = await request('GET', '/events/stats', { token: tokens.bob });
  assert.equal(statsAfter.body.data.totalEvents, statsBefore.body.data.totalEvents);
});

test('normal user cannot create unowned system events or smuggle non-string ids', async () => {
  for (const userId of [null, { $ne: null }, [String(bob._id)], 'not-an-id', MISSING_ID]) {
    const res = await ingest('alice', { userId });
    assert.equal(res.status, 403, `userId=${JSON.stringify(userId)}`);
  }
  assert.equal(await Event.countDocuments({ userId: null }), 0);
});

test('admin can attribute an event to an existing user, and that user sees it immediately', async () => {
  // Warm the victim-scoped stats cache first so a missing invalidation would show up.
  const warm = await request('GET', '/events/stats', { token: tokens.bob });
  const res = await ingest('admin', { userId: String(bob._id) });
  assert.equal(res.status, 201);
  assert.equal(ownerOf(res.body.data.event), String(bob._id));

  const after = await request('GET', '/events/stats', { token: tokens.bob });
  assert.equal(after.body.data.totalEvents, warm.body.data.totalEvents + 1);
});

test('admin can create a system event with userId: null', async () => {
  const res = await ingest('admin', { userId: null, service: 'system', eventType: 'system.error' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.event.userId, null);
});

test('admin targeting an invalid or unknown user is rejected without writing', async () => {
  const count = await Event.countDocuments();
  const invalid = await ingest('admin', { userId: 'not-an-id' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'INVALID_ID_FORMAT');
  const operator = await ingest('admin', { userId: { $ne: null } });
  assert.equal(operator.status, 400);
  const missing = await ingest('admin', { userId: MISSING_ID });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'TARGET_USER_NOT_FOUND');
  assert.equal(await Event.countDocuments(), count);
});

// ---- Notifications ------------------------------------------------------------

test('normal user test notification without recipient is delivered to themselves', async () => {
  const res = await notify('alice');
  assert.equal(res.status, 201);
  assert.equal(String(res.body.data.notification.recipient), String(alice._id));
});

test('normal user cannot send a notification to another user (regression)', async () => {
  const notesBefore = await Notification.countDocuments({ recipient: bob._id });
  const eventsBefore = await Event.countDocuments({ userId: bob._id });

  const res = await notify('alice', { recipient: String(bob._id), title: 'Reset your password' });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN_TARGET_USER');

  assert.equal(await Notification.countDocuments({ recipient: bob._id }), notesBefore);
  assert.equal(await Event.countDocuments({ userId: bob._id }), eventsBefore, 'no notification event emitted');
  const list = await request('GET', '/notifications', { token: tokens.bob });
  assert.ok(!list.body.data.some((n) => n.title === 'Reset your password'));
});

test('normal user may name themselves as recipient but not null or crafted values', async () => {
  const self = await notify('alice', { recipient: String(alice._id) });
  assert.equal(self.status, 201);
  for (const recipient of [null, { $ne: null }, 'not-an-id']) {
    const res = await notify('alice', { recipient });
    assert.equal(res.status, 403, `recipient=${JSON.stringify(recipient)}`);
  }
});

test('admin can notify another user, whose cached stats are invalidated', async () => {
  const warm = await request('GET', '/notifications/stats', { token: tokens.bob });
  const res = await notify('admin', { recipient: String(bob._id) });
  assert.equal(res.status, 201);
  assert.equal(String(res.body.data.notification.recipient), String(bob._id));

  const after = await request('GET', '/notifications/stats', { token: tokens.bob });
  assert.equal(after.body.data.total, warm.body.data.total + 1);
  assert.equal(after.body.data.unread, warm.body.data.unread + 1);
});

test('admin notification to null, invalid or unknown recipient is rejected', async () => {
  const count = await Notification.countDocuments();
  assert.equal((await notify('admin', { recipient: null })).status, 400);
  assert.equal((await notify('admin', { recipient: 'nope' })).status, 400);
  assert.equal((await notify('admin', { recipient: MISSING_ID })).status, 404);
  assert.equal(await Notification.countDocuments(), count);
});

test('notification dispatch is rate limited', async () => {
  const res = await notify('alice');
  assert.equal(res.status, 201);
  assert.ok(res.headers.get('ratelimit-limit'), 'standard RateLimit headers present on POST /notifications');
});

test('unauthenticated writes are still rejected', async () => {
  assert.equal((await request('POST', '/events', { body: { eventType: 'x', service: 'system' } })).status, 401);
  assert.equal((await request('POST', '/notifications', { body: { title: 't', message: 'm' } })).status, 401);
});
