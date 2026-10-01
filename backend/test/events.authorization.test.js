const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, tokenFor, request } = require('./helpers');

const User = require('../src/models/User');
const Event = require('../src/models/Event');

let alice; // normal user under test
let bob; // another normal user
let admin;
let aliceToken;
let adminToken;
let bobEventId;
let aliceEventId;

before(async () => {
  await start();
  [alice, bob, admin] = await User.create([
    { name: 'Alice', email: 'alice@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob', email: 'bob@test.local', password: 'Password123!', role: 'user' },
    { name: 'Root', email: 'root@test.local', password: 'Password123!', role: 'admin' },
  ]);
  aliceToken = tokenFor(alice);
  adminToken = tokenFor(admin);

  const now = Date.now();
  const make = (userId, eventType, i) => ({
    eventType,
    service: 'payment-service',
    source: 'stripe-webhook',
    status: 'error',
    userId,
    timestamp: new Date(now - i * 60000),
  });

  const docs = [];
  // Alice: 3 events, Bob: 12 events (all matching "payment"), system: 2 events.
  for (let i = 0; i < 3; i++) docs.push(make(alice._id, 'payment.failed', i));
  for (let i = 0; i < 12; i++) docs.push(make(bob._id, 'payment.failed', i + 10));
  for (let i = 0; i < 2; i++) docs.push(make(null, 'payment.success', i + 30));
  const created = await Event.insertMany(docs);
  aliceEventId = created[0]._id.toString();
  bobEventId = created[3]._id.toString();
});

after(stop);

const ownerIdsOf = (events) => events.map((e) => (e.userId ? String(e.userId._id ?? e.userId) : null));

const assertNoForeignEvents = (events) => {
  for (const owner of ownerIdsOf(events)) {
    assert.ok(owner === null || owner === String(alice._id), `leaked event owned by ${owner}`);
  }
};

test('normal user event list only returns own (and unowned system) events', async () => {
  const res = await request('GET', '/events?limit=100', { token: aliceToken });
  assert.equal(res.status, 200);
  assertNoForeignEvents(res.body.data);
  assert.equal(res.body.data.length, 5); // 3 own + 2 system
});

test('normal user search only returns own events (regression: search used to drop the scope)', async () => {
  const res = await request('GET', '/events?search=payment&limit=100', { token: aliceToken });
  assert.equal(res.status, 200);
  assertNoForeignEvents(res.body.data);
  assert.equal(res.body.data.length, 5);
  assert.ok(!ownerIdsOf(res.body.data).includes(String(bob._id)));
});

test('search combined with filters stays scoped', async () => {
  const res = await request('GET', '/events?search=failed&status=error&service=payment-service&limit=100', {
    token: aliceToken,
  });
  assert.equal(res.status, 200);
  assertNoForeignEvents(res.body.data);
  assert.equal(res.body.data.length, 3);
});

test('normal user pagination totals only count own events', async () => {
  const res = await request('GET', '/events?search=payment&limit=2&page=1', { token: aliceToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 5);
  assert.equal(res.body.pagination.totalPages, 3);

  const lastPage = await request('GET', '/events?search=payment&limit=2&page=3', { token: aliceToken });
  assertNoForeignEvents(lastPage.body.data);
  assert.equal(lastPage.body.data.length, 1);
});

test('normal user cannot retrieve another user’s event by ID', async () => {
  const res = await request('GET', `/events/${bobEventId}`, { token: aliceToken });
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('normal user can retrieve their own event by ID', async () => {
  const res = await request('GET', `/events/${aliceEventId}`, { token: aliceToken });
  assert.equal(res.status, 200);
  assert.equal(String(res.body.data.event.userId._id), String(alice._id));
});

test('query operators in filters are not interpreted', async () => {
  // A crafted value must not widen the scope (e.g. via regex wildcards).
  const res = await request('GET', `/events?search=${encodeURIComponent('.*')}&limit=100`, { token: aliceToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 0);
});

test('admin keeps full event visibility (list, search, pagination, detail)', async () => {
  const list = await request('GET', '/events?limit=100', { token: adminToken });
  assert.equal(list.status, 200);
  assert.equal(list.body.pagination.total, 17);

  const search = await request('GET', '/events?search=payment&limit=5', { token: adminToken });
  assert.equal(search.body.pagination.total, 17);

  const detail = await request('GET', `/events/${bobEventId}`, { token: adminToken });
  assert.equal(detail.status, 200);
});

test('event stats are scoped for normal users', async () => {
  const res = await request('GET', '/events/stats', { token: aliceToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.totalEvents, 5);
});
