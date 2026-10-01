const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const { redactMongoUri, describeMongoTarget, isInMemoryFallbackAllowed, connectDB } = require('../src/config/db');

// A URI with credentials that must never appear in output. Nothing listens on port 1.
const SECRET_PASSWORD = 'pw-' + crypto.randomBytes(6).toString('hex');
const UNREACHABLE_URI = `mongodb://dbadmin:${SECRET_PASSWORD}@127.0.0.1:1/notification_dashboard?authSource=admin`;

test('redactMongoUri removes credentials and query strings', () => {
  const redacted = redactMongoUri(`failed to reach ${UNREACHABLE_URI} quickly`);
  assert.ok(!redacted.includes(SECRET_PASSWORD));
  assert.ok(!redacted.includes('dbadmin'));
  assert.ok(!redacted.includes('authSource'));
  assert.match(redacted, /mongodb:\/\/\*\*\*@127\.0\.0\.1:1\/notification_dashboard/);
  assert.equal(
    redactMongoUri('mongodb+srv://u:p@cluster0.example.mongodb.net/app?retryWrites=true'),
    'mongodb+srv://***@cluster0.example.mongodb.net/app'
  );
  assert.equal(redactMongoUri('connect ECONNREFUSED 127.0.0.1:27017'), 'connect ECONNREFUSED 127.0.0.1:27017');
});

test('describeMongoTarget shows host/db only', () => {
  assert.equal(describeMongoTarget(UNREACHABLE_URI), '127.0.0.1:1/notification_dashboard');
  assert.equal(describeMongoTarget('not a uri'), 'configured MongoDB');
});

test('in-memory fallback is development-only', () => {
  assert.equal(isInMemoryFallbackAllowed('production'), false);
  assert.equal(isInMemoryFallbackAllowed('development'), true);
});

test('connectDB without fallback rejects instead of using an in-memory database', async () => {
  const previous = process.env.MONGODB_URI;
  process.env.MONGODB_URI = UNREACHABLE_URI;
  const logs = [];
  const originalWarn = console.warn;
  console.warn = (...args) => logs.push(args.join(' '));
  try {
    await assert.rejects(connectDB({ allowInMemoryFallback: false }), /MongoDB is unavailable/);
  } finally {
    console.warn = originalWarn;
    process.env.MONGODB_URI = previous;
  }
  assert.ok(logs.length > 0);
  for (const line of logs) assert.ok(!line.includes(SECRET_PASSWORD), `credential leaked: ${line}`);
});

test('production server exits clearly when MongoDB is unavailable, without leaking credentials', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      MONGODB_URI: UNREACHABLE_URI,
      PORT: '0',
    },
    encoding: 'utf8',
    timeout: 30000,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /Refusing to start without a database/);
  assert.ok(!/in-memory/i.test(output), 'must not fall back to an in-memory database');
  assert.ok(!output.includes(SECRET_PASSWORD), 'credentials must never be logged');
  assert.ok(!output.includes('dbadmin'), 'username must never be logged');
});
