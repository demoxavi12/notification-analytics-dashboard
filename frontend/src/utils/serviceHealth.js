// Interprets the health values produced by DashboardLayout's /health polling:
// 'checking' | 'connected' | 'disconnected' | 'unreachable' (API not reachable at all).
// Each state has a text label, so status is never conveyed by color alone.

export const HEALTH_LEVELS = {
  ok: { label: 'Operational', rank: 0 },
  checking: { label: 'Checking…', rank: 1 },
  degraded: { label: 'Degraded', rank: 2 },
  down: { label: 'Unavailable', rank: 3 },
};

const levelFor = (value, { degradesInsteadOfFailing = false } = {}) => {
  if (value === 'connected') return 'ok';
  if (!value || value === 'checking') return 'checking';
  if (value === 'unreachable') return 'down';
  return degradesInsteadOfFailing ? 'degraded' : 'down';
};

export const describeSystemHealth = (health) => {
  const database = health?.database;
  const redis = health?.redis;
  const apiReachable = database !== 'unreachable';

  const services = [
    {
      id: 'api',
      name: 'API server',
      level: !database || database === 'checking' ? 'checking' : apiReachable ? 'ok' : 'down',
      detail: apiReachable ? 'Responding to health checks' : 'Not responding',
    },
    {
      id: 'database',
      name: 'MongoDB',
      level: levelFor(database),
      detail: database === 'connected' ? 'Connected' : database === 'disconnected' ? 'Disconnected' : null,
    },
    {
      id: 'cache',
      name: 'Redis cache',
      // The backend falls back to an in-memory cache without Redis, so this degrades rather than fails.
      level: levelFor(redis, { degradesInsteadOfFailing: true }),
      detail: redis === 'connected' ? 'Connected' : redis === 'disconnected' ? 'In-memory fallback active' : null,
    },
  ];

  const worst = services.reduce((acc, s) => (HEALTH_LEVELS[s.level].rank > HEALTH_LEVELS[acc].rank ? s.level : acc), 'ok');
  const summary = {
    ok: 'All systems operational',
    checking: 'Checking system status…',
    degraded: 'Running in degraded mode',
    down: 'Some services are unavailable',
  }[worst];

  return { level: worst, summary, services };
};
