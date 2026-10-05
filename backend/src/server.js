const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { assertJwtConfig } = require('./config/jwt');

// Fail fast: refuse to start (instead of failing on the first login) when the JWT
// configuration is unsafe for this environment. Never logs the secret itself.
try {
  assertJwtConfig();
} catch (err) {
  console.error(`[Startup] ${err.message} Set a strong JWT_SECRET (see backend/.env.example).`);
  process.exit(1);
}

const { connectDB } = require('./config/db');
const { initRedis, closeRedis } = require('./config/redis');
const app = require('./app');

const { autoSeedIfEmpty } = require('./seed/autoSeed');

// Connect Database; demo data is auto-seeded only in development (see seed/autoSeed.js).
// In production a database failure is fatal (no silent in-memory fallback).
connectDB()
  .then(async () => {
    try {
      await autoSeedIfEmpty();
    } catch (err) {
      console.warn(`[Auto-Seed] Notice: ${err.message}`);
    }
  })
  .catch((err) => {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[Startup] ${err.message}`);
      process.exit(1);
    }
    console.error(`[MongoDB] Running without a database: ${err.message}`);
  });

// One shared Redis client for the process (optional cache; see config/redis.js).
initRedis();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
  console.log(`=============================================`);
});

// Handle graceful shutdown
let shuttingDown = false;
const gracefulShutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nReceived kill signal, shutting down gracefully...');
  // Don't hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    console.log('Closed remaining connections.');
    await closeRedis();
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;