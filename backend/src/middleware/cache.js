const crypto = require('crypto');
const { getRedisClient, isRedisConnected, redactRedisUrl } = require('../config/redis');

// Response cache for read-heavy aggregate endpoints (analytics + stats).
//
// Key format:  pulseops:cache:v2:<scope>:<resource>:<queryHash>
//   scope      "admin"        admins share one global view (these endpoints return the
//                             same data for every admin), or
//              "user:<id>"    any non-admin user: their own scoped data only.
//   resource   route identifier, e.g. "analytics:overview".
//   queryHash  SHA-256 of the sorted query params the route declares in `varyBy`
//              ("none" when there are none). Undeclared params are ignored because the
//              controller ignores them too, so they cannot fragment or poison the cache.
//
// Invalidation is targeted by key prefix (SCAN + UNLINK, never KEYS): a mutation
// clears the admin view plus the scopes of the users whose data changed.

const CACHE_PREFIX = 'pulseops:cache:v2';

// TTLs are a backstop; mutations invalidate affected keys immediately.
const CACHE_TTL_SECONDS = {
  analytics: 60, // aggregate KPIs/charts: comparatively expensive, change gradually
  stats: 30, // summary counters (unread counts etc.): change with user actions
};

const MAX_CACHED_BODY_BYTES = 256 * 1024; // never cache unusually large payloads
const MEMORY_MAX_ENTRIES = 500; // bound the per-process fallback store
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

let logger = console;
const setCacheLogger = (log) => {
  logger = log || console;
};

// --- Keys -----------------------------------------------------------------------------

const scopeFor = (user) => (user.role === 'admin' ? 'admin' : `user:${user._id}`);

const hashQuery = (query, varyBy) => {
  const pairs = [...varyBy]
    .sort()
    .filter((name) => query[name] !== undefined)
    .map((name) => [name, query[name]]);
  if (pairs.length === 0) return 'none';
  return crypto.createHash('sha256').update(JSON.stringify(pairs)).digest('hex').slice(0, 32);
};

const buildCacheKey = ({ user, resource, query = {}, varyBy = [] }) =>
  `${CACHE_PREFIX}:${scopeFor(user)}:${resource}:${hashQuery(query, varyBy)}`;

// --- Bounded in-memory fallback (used whenever Redis is not connected) ------------------

const memoryStore = new Map();

const memoryGet = (key) => {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.raw;
};

const memorySet = (key, raw, ttlSeconds) => {
  memoryStore.delete(key); // re-insert so Map order reflects recency
  memoryStore.set(key, { raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  while (memoryStore.size > MEMORY_MAX_ENTRIES) {
    memoryStore.delete(memoryStore.keys().next().value);
  }
};

const memoryDeletePrefixes = (prefixes) => {
  for (const key of memoryStore.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) memoryStore.delete(key);
  }
};

// --- Redis helpers ------------------------------------------------------------------------

// Set when invalidations could not reach Redis (outage). Entries written before the
// outage might now be stale, so the namespace is purged on the next connected use.
let redisNeedsPurge = false;

const scanDelete = async (client, prefix) => {
  let cursor = '0';
  do {
    const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
    cursor = next;
    if (keys.length > 0) await client.unlink(...keys);
  } while (cursor !== '0');
};

// Returns a usable Redis client, or null to use the memory store.
const connectedClient = async () => {
  const client = getRedisClient();
  if (!client || !isRedisConnected()) {
    if (client) redisNeedsPurge = true;
    return null;
  }
  if (redisNeedsPurge) {
    try {
      await scanDelete(client, `${CACHE_PREFIX}:`);
      redisNeedsPurge = false;
    } catch (err) {
      logger.warn(`[Cache] Could not purge stale entries after reconnect: ${redactRedisUrl(err.message)}`);
      return null;
    }
  }
  return client;
};

const deleteKey = async (key) => {
  memoryStore.delete(key);
  const client = getRedisClient();
  if (!client || !isRedisConnected()) return;
  try {
    await client.unlink(key);
  } catch {
    redisNeedsPurge = true;
  }
};

// --- Cache operations (never throw: the cache must not break a request) -----------------

const isCacheableBody = (body) => Boolean(body && typeof body === 'object' && body.success === true);

const readCache = async (key) => {
  let raw = null;
  try {
    const client = await connectedClient();
    raw = client ? await client.get(key) : memoryGet(key);
  } catch (err) {
    logger.warn(`[Cache] Read failed, serving uncached: ${redactRedisUrl(err.message)}`);
    return null;
  }
  if (raw === null || raw === undefined) return null;

  try {
    const parsed = JSON.parse(raw);
    if (isCacheableBody(parsed)) return parsed;
  } catch {
    // fall through: malformed entry
  }
  logger.warn('[Cache] Discarding malformed cache entry');
  await deleteKey(key);
  return null;
};

const writeCache = async (key, body, ttlSeconds) => {
  try {
    const raw = JSON.stringify(body);
    if (Buffer.byteLength(raw) > MAX_CACHED_BODY_BYTES) return false;
    const client = await connectedClient();
    if (client) {
      await client.set(key, raw, 'EX', ttlSeconds);
    } else {
      memorySet(key, raw, ttlSeconds);
    }
    return true;
  } catch (err) {
    logger.warn(`[Cache] Write failed: ${redactRedisUrl(err.message)}`);
    return false;
  }
};

// Clear the admin view plus the given users' scopes (or every user scope).
// Awaited by callers so a client refetching right after a mutation never gets the
// pre-mutation response; failures are logged and swallowed.
const invalidateCacheFor = async ({ userIds = [], allUsers = false } = {}) => {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  const everyUser = allUsers || ids.some((id) => !SAFE_ID.test(id));

  const prefixes = [`${CACHE_PREFIX}:admin:`];
  if (everyUser) prefixes.push(`${CACHE_PREFIX}:user:`);
  else ids.forEach((id) => prefixes.push(`${CACHE_PREFIX}:user:${id}:`));

  memoryDeletePrefixes(prefixes);

  const client = getRedisClient();
  if (!client) return;
  if (!isRedisConnected()) {
    redisNeedsPurge = true;
    return;
  }
  try {
    for (const prefix of prefixes) await scanDelete(client, prefix);
  } catch (err) {
    redisNeedsPurge = true;
    logger.warn(`[Cache] Invalidation failed; stale entries will be purged on reconnect: ${redactRedisUrl(err.message)}`);
  }
};

// --- Middleware ----------------------------------------------------------------------------

// Cache successful GET responses of an authenticated route. Must be mounted after
// `authenticate` so the key is always bound to the caller's authorization scope.
const cacheMiddleware = ({ resource, ttlSeconds, varyBy = [] }) => {
  if (!resource || !ttlSeconds) throw new Error('cacheMiddleware requires resource and ttlSeconds');

  return async (req, res, next) => {
    if (req.method !== 'GET' || !req.user) return next();

    const key = buildCacheKey({ user: req.user, resource, query: req.query, varyBy });
    const cached = await readCache(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && isCacheableBody(body)) {
        writeCache(key, body, ttlSeconds);
      }
      return originalJson(body);
    };
    return next();
  };
};

// Test-only reset of process-local cache state.
const resetCacheState = () => {
  memoryStore.clear();
  redisNeedsPurge = false;
};

module.exports = {
  CACHE_PREFIX,
  CACHE_TTL_SECONDS,
  MAX_CACHED_BODY_BYTES,
  MEMORY_MAX_ENTRIES,
  buildCacheKey,
  cacheMiddleware,
  invalidateCacheFor,
  readCache,
  writeCache,
  resetCacheState,
  setCacheLogger,
};
