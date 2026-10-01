// Security-relevant pure auth helpers. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getSafeRedirectPath } from '../src/utils/authSession.js';
import { normalizeEmail, validateEmail, validateName, validateNewPassword } from '../src/utils/authValidation.js';

test('post-login redirect only allows in-app paths (no open redirects)', () => {
  const backslash = String.fromCharCode(92);
  const unsafe = [
    'https://evil.example',
    '//evil.example',
    '/' + backslash + 'evil.example',
    'javascript:alert(1)',
    'evil.example/path',
    '',
    null,
    undefined,
    42,
  ];
  for (const candidate of unsafe) {
    assert.equal(getSafeRedirectPath(candidate), '/dashboard', String(candidate));
  }
});

test('post-login redirect keeps legitimate deep links and avoids auth-page loops', () => {
  assert.equal(getSafeRedirectPath('/events?status=error&page=2'), '/events?status=error&page=2');
  assert.equal(getSafeRedirectPath('/users'), '/users');
  assert.equal(getSafeRedirectPath('/login?expired=true'), '/dashboard');
  assert.equal(getSafeRedirectPath('/register'), '/dashboard');
  assert.equal(getSafeRedirectPath('/nope', '/analytics'), '/nope');
  assert.equal(getSafeRedirectPath(null, '/analytics'), '/analytics');
});

test('email normalization and validation', () => {
  assert.equal(normalizeEmail('  Alex@Company.COM '), 'alex@company.com');
  assert.equal(validateEmail('a+tag@x.io'), '');
  for (const bad of ['', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b.com.']) {
    assert.notEqual(validateEmail(bad), '', bad);
  }
});

test('registration password policy', () => {
  assert.equal(validateNewPassword('Sample#Pass2026'), '');
  assert.match(validateNewPassword('abc'), /at least 8 characters/);
  assert.match(validateNewPassword('alllowercase1!'), /uppercase/);
  assert.equal(validateNewPassword(''), 'Password is required.');
});

test('name validation', () => {
  assert.equal(validateName('José Núñez'), '');
  assert.notEqual(validateName('A'), '');
  assert.notEqual(validateName('123'), '');
});
