const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { start, stop, tokenFor, request } = require('./helpers');

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Notification = require('../src/models/Notification');

let alice;
let bob;
let admin;
let aliceToken;
let bobToken;
let adminToken;

before(async () => {
  await start();
  [alice, bob, admin] = await User.create([
    { name: 'Alice Anders', email: 'alice.i@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob (QA) Builder', email: 'bob.i@test.local', password: 'Password123!', role: 'user' },
    { name: 'Root Admin', email: 'root.i@test.local', password: 'Password123!', role: 'admin' },
  ]);
  aliceToken = tokenFor(alice);
  bobToken = tokenFor(bob);
  adminToken = tokenFor(admin);

  const now = Date.now();
  await Event.insertMany([
    ...Array.from({ length: 3 }, (_, i) => ({ eventType: 'api.request', service: 'api-gateway', status: 'success', userId: alice._id, timestamp: new Date(now - i * 60000) })),
    ...Array.from({ length: 7 }, (_, i) => ({ eventType: 'payment.failed', service: 'payment-service', status: 'error', userId: bob._id, timestamp: new Date(now - i * 60000) })),
    { eventType: 'system.error', service: 'system', status: 'error', userId: null, timestamp: new Date(now) },
  ]);
  await Notification.create([
    { recipient: bob._id, title: 'Bob only', message: 'for bob', status: 'delivered' },
    { recipient: bob._id, title: 'Bob failed', message: 'for bob', status: 'failed' },
  ]);
});

after(stop);

// ---- user search is plain text (was a regex) --------------------------------

test('admin user search treats input literally', async () => {
  const wildcard = await request('GET', `/users?search=${encodeURIComponent('.*')}`, { token: adminToken });
  assert.equal(wildcard.status, 200);
  assert.equal(wildcard.body.data.length, 0, '".*" must not match every user');

  const parens = await request('GET', `/users?search=${encodeURIComponent('(QA)')}`, { token: adminToken });
  assert.deepEqual(parens.body.data.map((u) => u.name), ['Bob (QA) Builder']);

  const normal = await request('GET', '/users?search=alice', { token: adminToken });
  assert.equal(normal.body.data.length, 1);
});

test('user list never returns password hashes', async () => {
  const res = await request('GET', '/users?limit=50', { token: adminToken });
  for (const user of res.body.data) {
    assert.equal(user.password, undefined);
  }
});

test('normal users are refused the users API', async () => {
  const res = await request('GET', '/users', { token: aliceToken });
  assert.equal(res.status, 403);
});

// ---- account status: inactive (deactivated) and suspended -------------------

test('inactive accounts cannot sign in or use existing sessions', async () => {
  const user = await User.create({ name: 'Ina Active', email: 'ina@test.local', password: 'Password123!', status: 'inactive' });
  const login = await request('POST', '/auth/login', { body: { email: 'ina@test.local', password: 'Password123!' } });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, 'ACCOUNT_INACTIVE');
  assert.equal(login.body.data, undefined, 'no token issued');

  const me = await request('GET', '/auth/me', { token: tokenFor(user) });
  assert.equal(me.status, 403);
  assert.equal(me.body.error.code, 'ACCOUNT_INACTIVE');
});

test('deactivating a user ends their access immediately; reactivating restores it', async () => {
  const user = await User.create({ name: 'Dee Activate', email: 'dee@test.local', password: 'Password123!' });
  const token = tokenFor(user);
  assert.equal((await request('GET', '/auth/me', { token })).status, 200);

  const deactivate = await request('PATCH', `/users/${user._id}/status`, { token: adminToken, body: { status: 'inactive' } });
  assert.equal(deactivate.status, 200);
  assert.equal((await request('GET', '/events', { token })).status, 403);

  await request('PATCH', `/users/${user._id}/status`, { token: adminToken, body: { status: 'active' } });
  assert.equal((await request('GET', '/auth/me', { token })).status, 200);
});

test('suspended accounts are still blocked', async () => {
  await User.create({ name: 'Sus Pended', email: 'sus@test.local', password: 'Password123!', status: 'suspended' });
  const login = await request('POST', '/auth/login', { body: { email: 'sus@test.local', password: 'Password123!' } });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, 'ACCOUNT_SUSPENDED');
});

// ---- analytics semantics + cross-user isolation ------------------------------

test('delivery rate is null (not 100%) when there are no notifications', async () => {
  const res = await request('GET', '/analytics/overview?range=7d', { token: aliceToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.kpis.totalNotifications, 0);
  assert.equal(res.body.data.kpis.deliveryRate, null);
});

test('delivery rate is computed when notifications exist', async () => {
  const res = await request('GET', '/analytics/overview?range=7d', { token: bobToken });
  assert.equal(res.body.data.kpis.totalNotifications, 2);
  assert.equal(res.body.data.kpis.deliveryRate, 50);
});

test('normal user analytics never include another user’s events', async () => {
  const overview = await request('GET', '/analytics/overview?range=7d', { token: aliceToken });
  assert.equal(overview.body.data.kpis.totalEvents, 4); // 3 own + 1 system
  assert.equal(overview.body.data.kpis.errorCount, 1); // only the system error, none of Bob's 7

  const series = await request('GET', '/analytics/timeseries?range=7d', { token: aliceToken });
  const total = series.body.data.timeline.reduce((sum, p) => sum + p.events, 0);
  assert.equal(total, 4);

  const dist = await request('GET', '/analytics/distributions?range=7d', { token: aliceToken });
  assert.ok(!dist.body.data.eventsByService.some((s) => s.name === 'payment-service'), 'Bob’s service must not appear');

  // Admins see everything in range. Compared with the database itself because other
  // tests' logins legitimately record auth events.
  const adminView = await request('GET', '/analytics/overview?range=7d', { token: adminToken });
  const allInRange = await Event.countDocuments({ timestamp: { $gte: new Date(Date.now() - 7 * 864e5) } });
  assert.equal(adminView.body.data.kpis.totalEvents, allInRange);
  assert.ok(allInRange >= 11);
});

// ---- seed never logs credentials ---------------------------------------------

test('seed scripts never print passwords', () => {
  const seedDir = path.join(__dirname, '..', 'src', 'seed');
  for (const file of fs.readdirSync(seedDir)) {
    const source = fs.readFileSync(path.join(seedDir, file), 'utf8');
    for (const call of source.match(/console\.(log|warn|error|info)\([^;]*\);/g) || []) {
      assert.ok(!/pass(word)?\s*[:=]|Pass123/i.test(call), `${file} logs a credential: ${call}`);
    }
  }
});
