// Shared test harness: in-memory MongoDB (mongodb-memory-server, already a project
// dependency) + the Express app on an ephemeral port. Uses Node's built-in test
// runner and fetch, so no extra test dependencies are needed.
const crypto = require('crypto');

// Must be set before any app module reads configuration.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let server;
let baseUrl;

const start = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = require('../src/app');
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  return baseUrl;
};

const stop = async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  // Close any Redis client a test wired up so the process can exit.
  await require('../src/config/redis').closeRedis();
};

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

const request = async (method, path, { token, body, headers } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json, headers: res.headers };
};

module.exports = { start, stop, tokenFor, request };
