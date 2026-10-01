const crypto = require('crypto');

// JWT signing configuration. There is deliberately NO hard-coded fallback secret:
//  - production: JWT_SECRET must be set, at least MIN_SECRET_LENGTH characters, and
//    not a known/placeholder value, otherwise the server refuses to start.
//  - development/test: if JWT_SECRET is missing, a random secret is generated for this
//    process only (tokens stop working after a restart) and a warning is logged.
//    Set JWT_SECRET in backend/.env (see .env.example) for stable local sessions.

const MIN_SECRET_LENGTH = 32;

// SHA-256 hashes of values that must never be accepted in production because they
// are public: the previously hard-coded fallback secret and documented placeholders.
// Stored as hashes so the old secret itself no longer appears anywhere in the code.
const KNOWN_INSECURE_SECRET_HASHES = new Set([
  '13fc48c24810b2c04c7bc893eb5d6e2bf57c5526e2132eb8542a90facab2cb65',
  '79ef599b03c84b902bc2c21405ad47203ca5606291b87fc383219ccc0c9d77f6',
  '057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86',
  'e2186dbdb1bb4193608605e84f33208765b5693b55edd4f730a719a100eeea6f',
  '2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b',
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

let ephemeralSecret = null;

const isProduction = () => process.env.NODE_ENV === 'production';

const validateSecret = (secret) => {
  if (!secret || !secret.trim()) return 'JWT_SECRET is not set';
  if (KNOWN_INSECURE_SECRET_HASHES.has(sha256(secret.trim()))) return 'JWT_SECRET is a known/placeholder value';
  if (secret.length < MIN_SECRET_LENGTH) return `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`;
  return null;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  const problem = validateSecret(secret);

  if (!problem) return secret;

  if (isProduction()) {
    // Never sign or verify tokens with a missing or guessable secret in production.
    throw new Error(`Invalid JWT configuration: ${problem}.`);
  }

  if (secret && secret.trim()) {
    // Dev/test with a weak but explicit secret: usable, but warn loudly (never log the value).
    if (!getJwtSecret.warned) {
      console.warn(`[JWT] Warning: ${problem}. This is only allowed outside production.`);
      getJwtSecret.warned = true;
    }
    return secret;
  }

  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(48).toString('hex');
    console.warn(
      '[JWT] JWT_SECRET is not set. Using a random secret for this process only; ' +
        'sessions will be invalidated on restart. Set JWT_SECRET in backend/.env.'
    );
  }
  return ephemeralSecret;
};

// Call at startup so a misconfigured production server fails immediately rather
// than on the first login request.
const assertJwtConfig = () => {
  getJwtSecret();
};

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

// Test helper: forget cached ephemeral state between test cases.
const resetJwtConfigForTests = () => {
  ephemeralSecret = null;
  getJwtSecret.warned = false;
};

module.exports = {
  getJwtSecret,
  getJwtExpiresIn,
  assertJwtConfig,
  validateSecret,
  MIN_SECRET_LENGTH,
  resetJwtConfigForTests,
};
