const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, request } = require('./helpers');

const User = require('../src/models/User');

before(start);
after(stop);

const register = (body) => request('POST', '/auth/register', { body });

test('registration with role "admin" still creates a normal user', async () => {
  // Also in NODE_ENV=development, which used to allow self-assigned admin.
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const res = await register({ name: 'Mallory', email: 'mallory@test.local', password: 'Password123!', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'user');
    const stored = await User.findOne({ email: 'mallory@test.local' });
    assert.equal(stored.role, 'user');
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
});

test('registration without a role creates a normal user', async () => {
  const res = await register({ name: 'Nina', email: 'nina@test.local', password: 'Password123!' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.role, 'user');
  assert.ok(res.body.data.token, 'a session token is issued');
});

test('other privileged fields in the registration body are ignored', async () => {
  const res = await register({
    name: 'Eve',
    email: 'eve@test.local',
    password: 'Password123!',
    role: 'admin',
    status: 'active',
    _id: '000000000000000000000001',
  });
  assert.equal(res.status, 201);
  const stored = await User.findOne({ email: 'eve@test.local' });
  assert.equal(stored.role, 'user');
  assert.notEqual(String(stored._id), '000000000000000000000001');
});

test('existing admin accounts keep working (login + admin-only route)', async () => {
  await User.create({ name: 'Ops Admin', email: 'ops@test.local', password: 'Password123!', role: 'admin' });
  const login = await request('POST', '/auth/login', { body: { email: 'ops@test.local', password: 'Password123!' } });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'admin');

  const users = await request('GET', '/users', { token: login.body.data.token });
  assert.equal(users.status, 200);
});

test('a registered user cannot reach admin-only routes', async () => {
  const res = await register({ name: 'Zed', email: 'zed@test.local', password: 'Password123!', role: 'admin' });
  const users = await request('GET', '/users', { token: res.body.data.token });
  assert.equal(users.status, 403);
});
