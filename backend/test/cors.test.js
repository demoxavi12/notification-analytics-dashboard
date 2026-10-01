const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Configure the allowed frontend origin before the app (and its CORS policy) loads.
process.env.CLIENT_URL = 'https://app.example.com';

const { start, stop } = require('./helpers');
const { createOriginChecker } = require('../src/config/cors');

let origin;

before(async () => {
  const apiBase = await start();
  origin = apiBase.replace(/\/api$/, '');
});
after(stop);

const preflight = (from) =>
  fetch(`${origin}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: from,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

test('configured CORS origin is allowed with credentials', async () => {
  const res = await preflight('https://app.example.com');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://app.example.com');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('disallowed CORS origin is rejected (no CORS headers granted)', async () => {
  const res = await preflight('https://evil.example');
  assert.equal(res.headers.get('access-control-allow-origin'), null);

  const get = await fetch(`${origin}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(get.headers.get('access-control-allow-origin'), null);
});

test('look-alike origins are not allowed', async () => {
  for (const evil of ['https://app.example.com.evil.example', 'http://app.example.com', 'https://evilapp.example.com']) {
    const res = await preflight(evil);
    assert.equal(res.headers.get('access-control-allow-origin'), null, evil);
  }
});

test('local development frontends are allowed outside production', async () => {
  const res = await preflight('http://localhost:5173');
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('origin policy: production allows only configured origins', () => {
  const allow = createOriginChecker({ clientUrl: 'https://app.example.com, https://admin.example.com/', nodeEnv: 'production' });
  assert.equal(allow('https://app.example.com'), true);
  assert.equal(allow('https://ADMIN.example.com'), true); // normalized
  assert.equal(allow('http://localhost:5173'), false); // no dev origins in production
  assert.equal(allow('https://evil.example'), false);
  assert.equal(allow(undefined), true); // no Origin header: not a cross-origin browser request
});

test('origin policy: nothing configured in production allows no cross-origin callers', () => {
  const allow = createOriginChecker({ clientUrl: '', nodeEnv: 'production' });
  assert.equal(allow('https://anything.example'), false);
  assert.equal(allow('http://localhost:5173'), false);
});
