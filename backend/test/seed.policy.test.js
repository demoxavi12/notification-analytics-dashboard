const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { start, stop } = require('./helpers');

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Notification = require('../src/models/Notification');
const { autoSeedIfEmpty, isAutoSeedAllowed, isManualSeedAllowed } = require('../src/seed/autoSeed');

const silent = { log: () => {} };
const clearAll = () => Promise.all([User.deleteMany({}), Event.deleteMany({}), Notification.deleteMany({})]);

before(start);
after(stop);
beforeEach(clearAll);

test('production never auto-seeds the default admin into an empty database', async () => {
  const status = await autoSeedIfEmpty({ env: 'production', logger: silent });
  assert.equal(status, 'skipped');
  assert.equal(await User.countDocuments(), 0);
  assert.equal(await User.countDocuments({ role: 'admin' }), 0);
});

test('unset / unknown NODE_ENV does not auto-seed (opt-in development only)', async () => {
  for (const env of [undefined, '', 'test', 'staging']) {
    assert.equal(await autoSeedIfEmpty({ env, logger: silent }), 'skipped', `env=${env}`);
  }
  assert.equal(await User.countDocuments(), 0);
  assert.equal(isAutoSeedAllowed('production'), false);
});

test('development still auto-seeds demo data into an empty database', async () => {
  const status = await autoSeedIfEmpty({ env: 'development', logger: silent });
  assert.equal(status, 'seeded');
  assert.ok((await User.countDocuments({ role: 'admin' })) >= 1, 'demo admin created');
  assert.ok((await User.countDocuments({ role: 'user' })) >= 1, 'demo users created');
  assert.ok((await Event.countDocuments()) > 0, 'demo events created');
});

test('development does not re-seed a database that already has users', async () => {
  await User.create({ name: 'Existing', email: 'existing@test.local', password: 'Password123!' });
  assert.equal(await autoSeedIfEmpty({ env: 'development', logger: silent }), 'not-empty');
  assert.equal(await User.countDocuments(), 1);
});

test('manual seed script refuses to run against production', () => {
  assert.equal(isManualSeedAllowed('production'), false);
  assert.equal(isManualSeedAllowed('development'), true);

  // The guard runs before any database connection is attempted.
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'seed', 'seed.js')], {
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to seed: NODE_ENV=production/);
});
