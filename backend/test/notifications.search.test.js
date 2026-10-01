const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, tokenFor, request } = require('./helpers');

const User = require('../src/models/User');
const Notification = require('../src/models/Notification');

let alice;
let bob;
let aliceToken;
let adminToken;

before(async () => {
  await start();
  let admin;
  [alice, bob, admin] = await User.create([
    { name: 'Alice', email: 'alice.n@test.local', password: 'Password123!', role: 'user' },
    { name: 'Bob', email: 'bob.n@test.local', password: 'Password123!', role: 'user' },
    { name: 'Root', email: 'root.n@test.local', password: 'Password123!', role: 'admin' },
  ]);
  aliceToken = tokenFor(alice);
  adminToken = tokenFor(admin);

  await Notification.create([
    { recipient: alice._id, title: 'Disk usage alert', message: 'Volume at 95% (critical)' },
    { recipient: alice._id, title: 'Weekly report', message: 'Your summary is ready.' },
    { recipient: bob._id, title: 'Disk usage alert', message: 'Bob volume at 99% (critical)' },
    { recipient: bob._id, title: 'Bob secret project update', message: 'Only for Bob.' },
  ]);
});

after(stop);

const search = (term, token, extra = '') =>
  request('GET', `/notifications?search=${encodeURIComponent(term)}&limit=50${extra}`, { token });

const recipientsOf = (res) => res.body.data.map((n) => String(n.recipient._id ?? n.recipient));

test('wildcard search is treated literally (no match-everything)', async () => {
  for (const term of ['.*', '.+', '^', '[a-z]+']) {
    const res = await search(term, aliceToken);
    assert.equal(res.status, 200, term);
    assert.equal(res.body.data.length, 0, `"${term}" must not act as a regex`);
  }
});

test('regex special characters match literally', async () => {
  const res = await search('(critical)', aliceToken);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((n) => n.title), ['Disk usage alert']);

  const percent = await search('95%', aliceToken);
  assert.equal(percent.body.data.length, 1);
});

test('normal search behaviour is preserved (case-insensitive, title and message)', async () => {
  assert.equal((await search('weekly', aliceToken)).body.data.length, 1);
  assert.equal((await search('SUMMARY', aliceToken)).body.data.length, 1);
});

test('normal-user search cannot escape ownership scope', async () => {
  // Matches notifications of both users; only Alice's may come back.
  const shared = await search('Disk usage', aliceToken);
  assert.deepEqual(recipientsOf(shared), [String(alice._id)]);
  assert.equal(shared.body.pagination.total, 1);

  // A term that only matches Bob's notifications returns nothing for Alice.
  const bobsOnly = await search('secret project', aliceToken);
  assert.equal(bobsOnly.body.data.length, 0);
  assert.equal(bobsOnly.body.pagination.total, 0);

  // Scope can't be widened with a recipient parameter either.
  const widened = await search('Disk usage', aliceToken, `&recipient=${bob._id}`);
  assert.deepEqual(recipientsOf(widened), [String(alice._id)]);
});

test('admin search keeps all-recipient visibility', async () => {
  const res = await search('Disk usage', adminToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
});
