const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true,
      index: true,
    },
    source: {
      type: String,
      default: 'web-app',
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    service: {
      type: String,
      required: [true, 'Service name is required'],
      enum: [
        'auth-service',
        'notification-service',
        'payment-service',
        'api-gateway',
        'system',
      ],
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'error', 'info'],
      default: 'info',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high performance querying & analytics
eventSchema.index({ timestamp: -1, service: 1 });
eventSchema.index({ timestamp: -1, status: 1 });
eventSchema.index({ service: 1, eventType: 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
