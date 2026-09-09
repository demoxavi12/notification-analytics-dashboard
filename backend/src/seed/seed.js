const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDB } = require('../config/db');
const { populateSeedData } = require('./seedData');

const seedDatabase = async () => {
  console.log('--- Starting Seed Script ---');

  try {
    await connectDB();
    console.log('[MongoDB] Connected successfully for seeding.');
  } catch (err) {
    console.error(`[MongoDB Error] Could not connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  try {
    await populateSeedData(true);

    console.log('\n=============================================');
    console.log(' Demo credentials ready:');
    console.log(' Admin User:');
    console.log('   Email:    admin@saas.local');
    console.log('   Password: AdminPass123!');
    console.log(' Regular User:');
    console.log('   Email:    user@saas.local');
    console.log('   Password: UserPass123!');
    console.log('=============================================\n');

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
};

seedDatabase();
