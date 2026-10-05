// MOCK — an in-process stand-in for an ioredis client, used because no real Redis
// server is available in this environment. It implements only the commands the cache
// layer uses (GET, SET EX, UNLINK, SCAN MATCH/COUNT, QUIT) plus connection events, and
// records every command so tests can assert e.g. that KEYS is never issued.
// It is NOT evidence of real Redis behaviour; see redis.unavailable.test.js for the
// real ioredis client against an unreachable server.
const { EventEmitter } = require('events');

class FakeRedis extends EventEmitter {
  constructor() {
    super();
    this.status = 'ready';
    this.store = new Map();
    this.calls = [];
    this.failing = false;
    this.clockOffsetMs = 0;
  }

  now() {
    return Date.now() + this.clockOffsetMs;
  }

  record(command) {
    this.calls.push(command);
    if (this.failing || this.status !== 'ready') throw new Error('Connection is closed.');
  }

  live(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async get(key) {
    this.record('get');
    return this.live(key)?.value ?? null;
  }

  async set(key, value, mode, ttlSeconds) {
    this.record('set');
    this.store.set(key, {
      value: String(value),
      expiresAt: mode === 'EX' ? this.now() + ttlSeconds * 1000 : null,
    });
    return 'OK';
  }

  // Remaining TTL in seconds (-2 missing, -1 no expiry), like Redis TTL.
  ttl(key) {
    const entry = this.live(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - this.now()) / 1000);
  }

  async unlink(...keys) {
    this.record('unlink');
    return keys.filter((key) => this.store.delete(key)).length;
  }

  // Cursor-paginated like Redis: COUNT bounds the keys examined per call, not matches.
  async scan(cursor, matchToken, pattern, countToken, count) {
    this.record('scan');
    if (matchToken !== 'MATCH' || countToken !== 'COUNT') throw new Error('unexpected SCAN syntax');
    if (!pattern.endsWith('*') || /[*?[\]]/.test(pattern.slice(0, -1))) {
      throw new Error(`fake SCAN supports prefix patterns only: ${pattern}`);
    }
    const prefix = pattern.slice(0, -1);
    const all = [...this.store.keys()].sort();
    const start = Number(cursor);
    const end = Math.min(start + count, all.length);
    const matches = all.slice(start, end).filter((key) => key.startsWith(prefix) && this.live(key));
    return [end >= all.length ? '0' : String(end), matches];
  }

  async keys() {
    this.calls.push('keys');
    throw new Error('KEYS must never be used');
  }

  async quit() {
    this.calls.push('quit');
    this.status = 'end';
    return 'OK';
  }

  disconnect() {
    this.calls.push('disconnect');
    this.status = 'end';
  }

  // Simulate an outage / recovery the way ioredis reports them.
  goDown(message = 'connect ECONNREFUSED 127.0.0.1:6379') {
    this.status = 'reconnecting';
    this.emit('error', new Error(message));
    this.emit('close');
  }

  comeBack() {
    this.status = 'ready';
    this.emit('ready');
  }
}

module.exports = { FakeRedis };
