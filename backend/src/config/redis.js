const Redis = require('ioredis');

// Redis is an optional accelerator (response cache). The API never depends on it for
// correctness or security: when Redis is not configured or unreachable, caching
// falls back to a bounded per-process memory store and every request still works.

// --- Configuration -----------------------------------------------------------------

const DEFAULT_DEV_REDIS_URL = 'redis://localhost:6379';

// Never log credentials: drop "user:pass@" from redis:// / rediss:// URLs (also inside
// error messages, which can echo the URL) and any query string.
const redactRedisUrl = (value) =>
  String(value ?? '')
    .replace(/(rediss?:\/\/)[^@/\s]+@/gi, '$1***@')
    .replace(/(rediss?:\/\/[^\s?]+)\?[^\s]*/gi, '$1');

// Which Redis URL (if any) to use for this environment:
// - REDIS_URL set: always used.
// - production without REDIS_URL: no Redis (explicit configuration is required; the
//   server warns loudly instead of guessing localhost).
// - test without REDIS_URL: no Redis, so tests never touch a developer's local data.
// - development without REDIS_URL: the conventional local default.
const resolveRedisUrl = (env = process.env) => {
  const configured = typeof env.REDIS_URL === 'string' ? env.REDIS_URL.trim() : '';
  if (configured) return configured;
  if (env.NODE_ENV === 'production' || env.NODE_ENV === 'test') return null;
  return DEFAULT_DEV_REDIS_URL;
};

// Reconnect forever with capped exponential backoff, so a Redis restart is picked
// up automatically instead of leaving the process on the memory fallback until restart.
const retryDelayMs = (attempt) => Math.min(250 * 2 ** Math.min(attempt, 6), 10000);

const CLIENT_OPTIONS = {
  connectTimeout: 3000,
  // Fail fast while disconnected (no unbounded offline queue) and bound each command,
  // so a slow or hung Redis can never stall an API request for long.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 1000,
  retryStrategy: retryDelayMs,
};

// --- Shared client + state ------------------------------------------------------------

let client = null;
let configured = false;
let ready = false;
let loggedUnavailable = false;
let logger = console;

// Connection failures can carry an empty message (e.g. an AggregateError when
// "localhost" resolves to both ::1 and 127.0.0.1); fall back to the error codes.
const describeError = (err) => {
  const nested = Array.isArray(err?.errors) ? err.errors.map((e) => e.code || e.message).filter(Boolean) : [];
  const text = err?.message || [...new Set(nested)].join(', ') || err?.code || 'connection failed';
  return redactRedisUrl(text);
};

const attachListeners = (redis, target) => {
  redis.on('ready', () => {
    ready = true;
    loggedUnavailable = false;
    logger.log(`[Redis] Connected to ${target}`);
  });
  redis.on('error', (err) => {
    // Log the first failure of each outage only; ioredis keeps retrying in the background.
    if (!loggedUnavailable) {
      loggedUnavailable = true;
      logger.warn(`[Redis] Unavailable at ${target} (${describeError(err)}); using the process-local memory cache until it reconnects.`);
    }
  });
  redis.on('close', () => {
    if (ready) logger.warn('[Redis] Connection lost; reconnecting in the background.');
    ready = false;
  });
};

// Create the one shared client for this process (idempotent). Pass `client` to wire a
// pre-built client (used by tests).
const initRedis = ({ env = process.env, client: injected, log } = {}) => {
  if (log) logger = log;
  if (client) return client;

  if (injected) {
    client = injected;
    configured = true;
    ready = injected.status === 'ready';
    attachListeners(injected, 'injected client');
    return client;
  }

  const url = resolveRedisUrl(env);
  if (!url) {
    configured = false;
    if (env.NODE_ENV === 'production') {
      logger.warn('[Redis] REDIS_URL is not set: Redis disabled, responses are cached in process-local memory only.');
    }
    return null;
  }

  configured = true;
  client = new Redis(url, CLIENT_OPTIONS);
  attachListeners(client, redactRedisUrl(url));
  return client;
};

const getRedisClient = () => client;

const isRedisConnected = () => Boolean(client && ready && client.status === 'ready');

// 'connected' | 'disconnected' (configured but unreachable) | 'disabled' (not configured)
const getRedisStatus = () => {
  if (!configured) return 'disabled';
  return isRedisConnected() ? 'connected' : 'disconnected';
};

// Graceful shutdown: QUIT lets pending replies drain; fall back to a hard disconnect.
const closeRedis = async () => {
  const current = client;
  client = null;
  configured = false;
  ready = false;
  loggedUnavailable = false;
  if (!current) return;
  try {
    if (current.status === 'ready') {
      await current.quit();
      return;
    }
  } catch {
    // fall through to disconnect
  }
  current.disconnect();
};

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  getRedisStatus,
  closeRedis,
  redactRedisUrl,
  resolveRedisUrl,
  retryDelayMs,
};
