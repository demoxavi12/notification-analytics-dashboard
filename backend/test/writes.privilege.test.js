// Privilege-bearing request fields on writes (complements writes.authorization.test.js):
// alternate ownership/recipient field names, spoofed internal fields, delivery status,
// and the "system" event simulation, which used to let any user create an unowned
// event shown to every account. Uses the real app + in-memory MongoDB; no Redis.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, tokenFor, request } = require('./helpers');

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Notification = require('../src/models/Notification');

let alice;
let bob;
let admin;
let tokens;

before(async () => {
  await start();
  [alice, bob, admin] = await User.create([
    { name: 'Alice Priv', email: 'alice.priv@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob Priv', email: 'bob.priv@test.local', password: 'Password123!', role: 'user' },
    { name: 'Admin Priv', email: 'admin.priv@test.local', password: 'Password123!', role: 'admin' },
  ]);
  tokens = { alice: tokenFor(alice), bob: tokenFor(bob), admin: tokenFor(admin) };
});

after(stop);

const bobView = async () => {
  const [events, eventStats, notifications, notificationStats] = await Promise.all([
    request('GET', '/events?limit=100', { token: tokens.bob }),
    request('GET', '/events/stats', { token: tokens.bob }),
    request('GET', '/notifications?limit=100', { token: tokens.bob }),
    request('GET', '/notifications/stats', { token: tokens.bob }),
  ]);
  return {
    eventIds: events.body.data.map((e) => e._id).sort(),
    eventTotal: eventStats.body.data.totalEvents,
    notificationIds: notifications.body.data.map((n) => n._id).sort(),
    notificationTotal: notificationStats.body.data.total,
    dbEvents: await Event.countDocuments({ $or: [{ userId: bob._id }, { userId: null }] }),
    dbNotifications: await Notification.countDocuments({ recipient: bob._id }),
  };
};

// ---- Events ---------------------------------------------------------------------

test('alternate ownership fields and spoofed internal fields are ignored on event ingestion', async () => {
  const before = await bobView();
  const forged = new Date('2001-01-01T00:00:00Z').toISOString();
  const res = await request('POST', '/events', {
    token: tokens.alice,
    body: {
      eventType: 'payment.success',
      service: 'payment-service',
      user: String(bob._id),
      ownerId: String(bob._id),
      createdBy: String(bob._id),
      actorId: String(bob._id),
      recipient: String(bob._id),
      role: 'admin',
      system: true,
      timestamp: forged,
      _id: '64b7f0c2a1b2c3d4e5f60718',
    },
  });
  assert.equal(res.status, 201);
  const stored = await Event.findById(res.body.data.event._id).lean();
  assert.equal(String(stored.userId), String(alice._id), 'owned by the caller');
  assert.notEqual(String(stored._id), '64b7f0c2a1b2c3d4e5f60718', 'client cannot choose the id');
  assert.ok(stored.timestamp.getTime() > Date.parse(forged), 'client cannot backdate events');
  for (const field of ['user', 'ownerId', 'createdBy', 'actorId', 'recipient', 'role', 'system']) {
    assert.equal(stored[field], undefined, `${field} is not persisted`);
  }
  assert.deepEqual(await bobView(), before, 'bob\'s data is unchanged');
});

test('a normal user\'s "system" simulation stays in their own scope', async () => {
  const before = await bobView();
  const res = await request('POST', '/events/simulate', { token: tokens.alice, body: { serviceType: 'system' } });
  assert.equal(res.status, 200);
  assert.equal(String(res.body.data.event.userId), String(alice._id), 'not an unowned global event');
  assert.deepEqual(await bobView(), before, 'other users never see it');

  const adminView = await request('GET', '/events?limit=100', { token: tokens.admin });
  assert.ok(adminView.body.data.some((e) => e._id === res.body.data.event._id), 'admins still see it');
});

test('every simulation type is owned by the caller for normal users', async () => {
  for (const serviceType of ['payment', 'notification', 'auth', 'system', 'unknown']) {
    const res = await request('POST', '/events/simulate', { token: tokens.alice, body: { serviceType, userId: String(bob._id) } });
    assert.equal(res.status, 200, serviceType);
    assert.equal(String(res.body.data.event.userId), String(alice._id), serviceType);
  }
});

test('an admin "system" simulation is still a global system event visible to everyone', async () => {
  const res = await request('POST', '/events/simulate', { token: tokens.admin, body: { serviceType: 'system' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.event.userId, null);
  const bobEvents = await request('GET', '/events?limit=100', { token: tokens.bob });
  assert.ok(bobEvents.body.data.some((e) => e._id === res.body.data.event._id));
});

// ---- Notifications -----------------------------------------------------------------

test('alternate recipient fields cannot redirect a notification', async () => {
  const before = await bobView();
  const res = await request('POST', '/notifications', {
    token: tokens.alice,
    body: {
      title: 'Sneaky',
      message: 'm',
      recipientId: String(bob._id),
      userId: String(bob._id),
      to: String(bob._id),
      user: String(bob._id),
      read: true,
      createdAt: '2001-01-01T00:00:00Z',
    },
  });
  assert.equal(res.status, 201);
  const stored = await Notification.findById(res.body.data.notification._id).lean();
  assert.equal(String(stored.recipient), String(alice._id));
  assert.equal(stored.read, false, 'client cannot pre-mark as read');
  assert.ok(stored.createdAt.getTime() > Date.parse('2001-01-02'), 'client cannot backdate');
  assert.deepEqual(await bobView(), before);
});

test('normal users cannot set a delivery status; nothing is written', async () => {
  for (const status of ['failed', 'pending', 'delivered']) {
    const count = await Notification.countDocuments();
    const res = await request('POST', '/notifications', { token: tokens.alice, body: { title: 't', message: 'm', status } });
    assert.equal(res.status, 403, status);
    assert.equal(res.body.error.code, 'FORBIDDEN_FIELD');
    assert.equal(await Notification.countDocuments(), count, 'no notification created');
  }
});

test('the frontend test-notification payload still works for normal users', async () => {
  const res = await request('POST', '/notifications', {
    token: tokens.alice,
    body: { title: 'Test', message: 'Hello', type: 'warning', channel: 'email' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.notification.status, 'delivered');
  assert.equal(String(res.body.data.notification.recipient), String(alice._id));
});

test('admins can still dispatch with an explicit delivery status to another user', async () => {
  const res = await request('POST', '/notifications', {
    token: tokens.admin,
    body: { title: 'Ops', message: 'Bounce', status: 'failed', recipient: String(bob._id) },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.notification.status, 'failed');
  assert.equal(String(res.body.data.notification.recipient), String(bob._id));
});

test('privilege-bearing fields cannot escalate the caller', async () => {
  await request('POST', '/events', {
    token: tokens.alice,
    body: { eventType: 'x', service: 'system', role: 'admin', user: { role: 'admin' } },
  });
  await request('POST', '/notifications', { token: tokens.alice, body: { title: 't', message: 'm', role: 'admin' } });
  const me = await request('GET', '/auth/me', { token: tokens.alice });
  assert.equal(me.body.data.user.role, 'user');
  assert.equal((await request('GET', '/users', { token: tokens.alice })).status, 403);
});
