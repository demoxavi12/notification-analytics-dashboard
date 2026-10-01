const User = require('../models/User');
const { populateSeedData } = require('./seedData');

// The demo dataset creates accounts with credentials published in this repository
// (including an admin), so it must only ever run in local development.
//
// Auto-seed requires an explicit NODE_ENV=development (set in backend/.env and
// .env.example). An unset or unrecognised NODE_ENV is treated as "not development",
// so a deployment that forgets NODE_ENV can never create the default admin.
const isAutoSeedAllowed = (env = process.env.NODE_ENV) => env === 'development';

// Manual `npm run seed` is explicit but destructive (it clears all collections) and
// creates the same known accounts, so it is refused in production.
const isManualSeedAllowed = (env = process.env.NODE_ENV) => env !== 'production';

// Seeds demo data into an empty database in development only.
// Returns a status string so callers/tests can see what happened.
const autoSeedIfEmpty = async ({ env = process.env.NODE_ENV, logger = console } = {}) => {
  if (!isAutoSeedAllowed(env)) {
    logger.log(`[Auto-Seed] Skipped: demo data is only seeded automatically when NODE_ENV=development.`);
    return 'skipped';
  }

  const userCount = await User.countDocuments();
  if (userCount > 0) return 'not-empty';

  logger.log('[Auto-Seed] Empty development database detected. Populating demo data...');
  await populateSeedData(false);
  logger.log('[Auto-Seed] Demo data ready.');
  return 'seeded';
};

module.exports = { autoSeedIfEmpty, isAutoSeedAllowed, isManualSeedAllowed };
