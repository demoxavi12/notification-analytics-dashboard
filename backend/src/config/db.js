const mongoose = require('mongoose');

let isConnected = false;
let memoryServer = null;

// Never log credentials: replace "user:pass@" in any MongoDB URI (also inside error
// messages, which can echo the URI) and drop query strings that may carry secrets.
const redactMongoUri = (value) =>
  String(value ?? '')
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi, '$1***@')
    .replace(/(mongodb(?:\+srv)?:\/\/[^\s?]+)\?[^\s]*/gi, '$1');

// Host part only, for "connected to X" style messages.
const describeMongoTarget = (uri) => {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/?]+)(\/[^?]*)?/i.exec(String(uri ?? ''));
  return match ? `${match[1]}${match[2] || ''}` : 'configured MongoDB';
};

// The in-memory engine is a development convenience only. In production a missing
// database must fail loudly instead of silently running on a throwaway store
// (which would lose every write on restart while looking healthy).
const isInMemoryFallbackAllowed = (env = process.env.NODE_ENV) => env !== 'production';

const connectDB = async ({ allowInMemoryFallback = isInMemoryFallbackAllowed() } = {}) => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/notification_dashboard';

  try {
    mongoose.set('strictQuery', false);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error) {
    const reason = redactMongoUri(error.message);
    console.warn(`[MongoDB] Could not connect to ${describeMongoTarget(mongoUri)}: ${reason}`);

    if (!allowInMemoryFallback) {
      isConnected = false;
      throw new Error(`MongoDB is unavailable (${describeMongoTarget(mongoUri)}). Refusing to start without a database.`);
    }

    console.log('[MongoDB] Development mode: starting embedded in-memory MongoDB (data is NOT persisted).');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'notification_dashboard',
        },
      });
      await mongoose.connect(memoryServer.getUri());
      isConnected = true;
      console.log('[MongoDB Embedded] Connected to in-memory database.');
    } catch (fallbackError) {
      isConnected = false;
      console.error(`[MongoDB] Critical: embedded MongoDB fallback failed: ${redactMongoUri(fallbackError.message)}`);
      throw fallbackError;
    }
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB] Runtime error: ${redactMongoUri(err.message)}`);
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
  redactMongoUri,
  describeMongoTarget,
  isInMemoryFallbackAllowed,
};
