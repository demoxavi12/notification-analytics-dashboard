const express = require('express');
const cors = require('cors');
const { buildCorsOptions } = require('./config/cors');
const { resolveTrustProxy } = require('./config/proxy');

// Express application (routes + middleware) without side effects: no database
// connection, no listening socket. server.js wires those up; tests mount this directly.

// Middleware
const { generalApiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// Client IP resolution for rate limiting (see config/proxy.js).
app.set('trust proxy', resolveTrustProxy());

// CORS: configured origins only (see config/cors.js); never "allow everything".
app.use(cors(buildCorsOptions()));

// Standard Body Parsers
// The largest legitimate payload is an event with up to 16 KB of metadata (see
// utils/queryInput.js), so 100 KB leaves ample headroom while bounding abuse.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'Notification & Analytics Dashboard API',
    version: '1.0.0',
    status: 'online',
    documentation: '/api/health',
  });
});

// Health check endpoint (exempt from rate limits)
app.use('/api/health', healthRoutes);

// Apply general rate limiter to API routes
app.use('/api/', generalApiLimiter);

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Catch 404 and forward to error handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
