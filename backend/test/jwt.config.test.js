const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { getJwtSecret, validateSecret, resetJwtConfigForTests } = require('../src/config/jwt');

const SRC_DIR = path.join(__dirname, '..', 'src');
const ORIGINAL_ENV = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET };

beforeEach(() => resetJwtConfigForTests());
afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('production: missing JWT_SECRET throws instead of falling back', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;
  assert.throws(() => getJwtSecret(), /JWT_SECRET is not set/);
});

test('production: short or placeholder secrets are rejected', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'too-short';
  assert.throws(() => getJwtSecret(), /at least 32 characters/);
  process.env.JWT_SECRET = 'replace-with-a-long-random-secret';
  assert.throws(() => getJwtSecret(), /known\/placeholder/);
});

test('production: the previously hard-coded fallback secret is rejected', () => {
  process.env.NODE_ENV = 'production';
  // Built from parts so the old value never appears verbatim in the repository.
  process.env.JWT_SECRET = ['super', 'secret', 'jwt', 'key', 'notification', 'saas', '2025'].join('_');
  assert.throws(() => getJwtSecret(), /known\/placeholder/);
});

test('production: a strong secret is used as-is', () => {
  process.env.NODE_ENV = 'production';
  const strong = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = strong;
  assert.equal(getJwtSecret(), strong);
  assert.equal(validateSecret(strong), null);
});

test('development: missing secret uses a random per-process secret, never a known value', () => {
  process.env.NODE_ENV = 'development';
  delete process.env.JWT_SECRET;
  const first = getJwtSecret();
  assert.ok(first.length >= 64);
  assert.equal(getJwtSecret(), first, 'stable within the process');
  resetJwtConfigForTests();
  assert.notEqual(getJwtSecret(), first, 'not a fixed/default value');
});

test('server refuses to start in production without JWT_SECRET', () => {
  // JWT_SECRET is defined but empty so dotenv (which never overrides existing vars)
  // cannot fill it from a local .env file.
  const result = spawnSync(process.execPath, [path.join(SRC_DIR, 'server.js')], {
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', PORT: '0' },
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(result.status, 1, `expected exit code 1, got ${result.status}`);
  assert.match(result.stderr, /Invalid JWT configuration: JWT_SECRET is not set/);
});

test('no hard-coded JWT secret or fallback remains in the source', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(SRC_DIR);

  const oldSecret = ['super', 'secret', 'jwt', 'key', 'notification', 'saas', '2025'].join('_');
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!source.includes(oldSecret), `${path.relative(SRC_DIR, file)} contains the old hard-coded secret`);
    assert.ok(!/JWT_SECRET\s*(\|\||\?\?)/.test(source), `${path.relative(SRC_DIR, file)} has a JWT_SECRET fallback`);
  }

  // jwt.sign / jwt.verify must only receive the validated secret.
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const call of source.match(/jwt\.(sign|verify)\([^)]*\)/g) || []) {
      assert.match(call, /getJwtSecret\(\)/, `${path.relative(SRC_DIR, file)}: ${call}`);
    }
  }
});
