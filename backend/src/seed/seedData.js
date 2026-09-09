const User = require('../models/User');
const Event = require('../models/Event');
const Notification = require('../models/Notification');

const populateSeedData = async (clearExisting = true) => {
  if (clearExisting) {
    console.log('[Seed] Clearing existing collections...');
    await User.deleteMany({});
    await Event.deleteMany({});
    await Notification.deleteMany({});
  }

  // 1. Create Users
  console.log('[Seed] Creating demo users...');
  const adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@saas.local',
    password: 'AdminPass123!',
    role: 'admin',
    status: 'active',
  });

  const standardUser = await User.create({
    name: 'Alex Johnson',
    email: 'user@saas.local',
    password: 'UserPass123!',
    role: 'user',
    status: 'active',
  });

  const devUser = await User.create({
    name: 'Sarah Connor',
    email: 'sarah.ops@saas.local',
    password: 'UserPass123!',
    role: 'user',
    status: 'active',
  });

  const testUsers = [adminUser, standardUser, devUser];

  // 2. Generate Realistic Multi-Service Events over the past 14 days
  console.log('[Seed] Generating realistic multi-service events...');
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const eventsToInsert = [];

  const serviceEventPool = [
    {
      service: 'auth-service',
      eventType: 'user.signup',
      source: 'auth-api',
      status: 'success',
      metadata: { provider: 'email', platform: 'web' },
    },
    {
      service: 'auth-service',
      eventType: 'user.login',
      source: 'web-app',
      status: 'success',
      metadata: { ip: '192.168.1.45', client: 'Chrome 128' },
    },
    {
      service: 'auth-service',
      eventType: 'user.login.failed',
      source: 'web-app',
      status: 'warning',
      metadata: { ip: '203.0.113.19', reason: 'Invalid password attempt' },
    },
    {
      service: 'notification-service',
      eventType: 'notification.sent',
      source: 'queue-worker',
      status: 'info',
      metadata: { channel: 'email', template: 'welcome_v2' },
    },
    {
      service: 'notification-service',
      eventType: 'notification.delivered',
      source: 'smtp-relay',
      status: 'success',
      metadata: { channel: 'email', latencyMs: 142 },
    },
    {
      service: 'notification-service',
      eventType: 'notification.failed',
      source: 'fcm-provider',
      status: 'error',
      metadata: { channel: 'push', reason: 'Device token expired' },
    },
    {
      service: 'payment-service',
      eventType: 'payment.success',
      source: 'stripe-webhook',
      status: 'success',
      metadata: { amount: 49.99, currency: 'USD', plan: 'pro_monthly' },
    },
    {
      service: 'payment-service',
      eventType: 'payment.failed',
      source: 'stripe-webhook',
      status: 'error',
      metadata: { amount: 199.00, currency: 'USD', reason: 'Card declined' },
    },
    {
      service: 'api-gateway',
      eventType: 'api.request',
      source: 'envoy-proxy',
      status: 'info',
      metadata: { method: 'GET', endpoint: '/api/v1/metrics', latencyMs: 38 },
    },
    {
      service: 'system',
      eventType: 'system.error',
      source: 'background-worker',
      status: 'error',
      metadata: { error: 'Redis socket timeout', retries: 3 },
    },
  ];

  for (let day = 14; day >= 0; day--) {
    const countForDay = Math.floor(Math.random() * 7) + 6;
    for (let j = 0; j < countForDay; j++) {
      const template = serviceEventPool[Math.floor(Math.random() * serviceEventPool.length)];
      const assignedUser = Math.random() > 0.3 ? testUsers[Math.floor(Math.random() * testUsers.length)]._id : null;
      const randomHourOffset = Math.floor(Math.random() * 24) * 60 * 60 * 1000 + Math.floor(Math.random() * 60) * 60 * 1000;
      const timestamp = new Date(now - day * dayMs + randomHourOffset);

      eventsToInsert.push({
        eventType: template.eventType,
        source: template.source,
        service: template.service,
        status: template.status,
        userId: assignedUser,
        metadata: { ...template.metadata, randomSeed: Math.floor(Math.random() * 1000) },
        timestamp,
      });
    }
  }

  await Event.insertMany(eventsToInsert);

  // 3. Generate Realistic Notifications
  console.log('[Seed] Generating realistic notifications...');
  const notificationTemplates = [
    {
      title: 'New Feature Announcement: Redis Invalidation',
      message: 'Real-time cache clearing is now active across all API gateways.',
      type: 'info',
      channel: 'in-app',
      status: 'delivered',
      read: false,
    },
    {
      title: 'Security Alert: Login from new IP',
      message: 'A login to your dashboard was recorded from IP 203.0.113.19.',
      type: 'warning',
      channel: 'email',
      status: 'delivered',
      read: false,
    },
    {
      title: 'Monthly Subscription Renewed',
      message: 'Your Pro Plan subscription was successfully renewed for $49.99.',
      type: 'success',
      channel: 'in-app',
      status: 'delivered',
      read: true,
    },
    {
      title: 'Delivery Failure: SMS Gateway',
      message: 'Could not deliver SMS alert due to carrier throttling. Retrying in 5m.',
      type: 'error',
      channel: 'push',
      status: 'failed',
      read: false,
    },
    {
      title: 'API Rate Limit Threshold',
      message: 'Your application reached 80% of its hourly rate limit quota.',
      type: 'warning',
      channel: 'in-app',
      status: 'delivered',
      read: true,
    },
    {
      title: 'Database Backup Completed',
      message: 'Automated snapshot backup completed in 3.4 seconds without errors.',
      type: 'success',
      channel: 'in-app',
      status: 'delivered',
      read: true,
    },
    {
      title: 'Webhook Endpoint Warning',
      message: 'Your endpoint https://api.partner.io/webhook returned 504 Gateway Timeout.',
      type: 'error',
      channel: 'email',
      status: 'delivered',
      read: false,
    },
    {
      title: 'Welcome to the Dashboard',
      message: 'Explore metrics, view events across 3 services, and manage alerts.',
      type: 'info',
      channel: 'in-app',
      status: 'delivered',
      read: false,
    },
  ];

  const notificationsToInsert = [];

  for (let i = 0; i < 20; i++) {
    const template = notificationTemplates[i % notificationTemplates.length];
    const timeOffset = Math.floor(Math.random() * 10) * dayMs + Math.floor(Math.random() * 12) * 3600000;
    notificationsToInsert.push({
      recipient: adminUser._id,
      title: template.title,
      message: template.message,
      type: template.type,
      channel: template.channel,
      status: template.status,
      read: i > 5 ? template.read : false,
      createdAt: new Date(now - timeOffset),
    });
  }

  for (let i = 0; i < 15; i++) {
    const template = notificationTemplates[(i + 2) % notificationTemplates.length];
    const timeOffset = Math.floor(Math.random() * 8) * dayMs + Math.floor(Math.random() * 8) * 3600000;
    notificationsToInsert.push({
      recipient: standardUser._id,
      title: template.title,
      message: template.message,
      type: template.type,
      channel: template.channel,
      status: template.status,
      read: i > 3 ? template.read : false,
      createdAt: new Date(now - timeOffset),
    });
  }

  await Notification.insertMany(notificationsToInsert);

  console.log(`[Seed] Successfully seeded ${eventsToInsert.length} events and ${notificationsToInsert.length} notifications.`);
};

module.exports = {
  populateSeedData,
};
