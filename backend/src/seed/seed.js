const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB } = require('../config/db');
const { populateSeedData } = require('./seedData');
const { isManualSeedAllowed } = require('./autoSeed');

const seedDatabase = async () => {
  console.log('--- Starting Seed Script ---');

  // Destructive (clears all collections) and creates accounts with published
  // credentials, so never allowed against a production database.
  if (!isManualSeedAllowed()) {
    console.error('[Seed] Refusing to seed: NODE_ENV=production. Demo data is for local development only.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('[MongoDB] Connected successfully for seeding.');
  } catch (err) {
    console.error(`[MongoDB Error] Could not connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  try {
    await populateSeedData(true);

    // Credentials are never printed. The local demo accounts are defined in
    // src/seed/seedData.js (development only; seeding is refused in production).
    console.log('[Seed] Demo users, events and notifications created (accounts: see src/seed/seedData.js).');
    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
};

seedDatabase();
