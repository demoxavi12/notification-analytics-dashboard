const mongoose = require('mongoose');

let isConnected = false;
let memoryServer = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/notification_dashboard';

  try {
    mongoose.set('strictQuery', false);

    // Try connecting to configured MongoDB URI with a short timeout
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error) {
    console.warn(`[MongoDB] Could not connect to local URI (${mongoUri}): ${error.message}`);
    console.log('[MongoDB] Activating embedded MongoDB in-memory engine fallback...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'notification_dashboard',
        },
      });
      const memoryUri = memoryServer.getUri();

      await mongoose.connect(memoryUri);
      isConnected = true;
      console.log(`[MongoDB Embedded] Successfully initialized and connected to: ${memoryUri}`);
    } catch (fallbackError) {
      isConnected = false;
      console.error(`[MongoDB] Critical: Embedded MongoDB fallback failed: ${fallbackError.message}`);
    }
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB] Runtime error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
});

const isDbConnected = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
};

module.exports = {
  connectDB,
  isDbConnected,
  disconnectDB,
};
