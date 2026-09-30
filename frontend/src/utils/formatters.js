// Display formatting shared across the app. Uses the built-in Intl APIs so we
// don't need a date/number library.

const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const absoluteDateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const isValidNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// 12345 -> "12,345"; values >= 100k use compact notation ("1.2M") to fit KPI tiles.
export const formatCount = (value) => {
  if (!isValidNumber(value)) return '—';
  return Math.abs(value) >= 100000 ? compactFormat.format(value) : integerFormat.format(value);
};

// 97.456 -> "97.5%"
export const formatPercent = (value, fractionDigits = 1) => {
  if (!isValidNumber(value)) return '—';
  return `${value.toFixed(fractionDigits).replace(/\.0+$/, '')}%`;
};

export const formatLatency = (ms) => {
  if (!isValidNumber(ms)) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
};

export const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Full, unambiguous local date/time, e.g. "28 Sep 2026, 14:05". Used for tooltips
// and screen readers alongside relative labels.
export const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? absoluteDateTimeFormat.format(date) : 'Unknown time';
};

const RELATIVE_UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

// "just now", "5 minutes ago", "yesterday", "3 days ago"
export const formatRelativeTime = (value, now = Date.now()) => {
  const date = toDate(value);
  if (!date) return 'Unknown time';
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  // Slightly-future times come from a `now` that ticks once a minute or small
  // server/client clock skew; "in 1 minute" would be misleading for a new record.
  if (diffSeconds > -45 && diffSeconds < 300) return 'just now';
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeFormat.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return relativeFormat.format(Math.round(diffSeconds / 60), 'minute');
};

const ACRONYMS = new Set(['api', 'sms', 'smtp', 'http', 'id', 'ip', 'url', 'fcm']);

// "payment.failed" -> "Payment failed", "api.request" -> "API request"
export const humanizeIdentifier = (value) => {
  if (!value || typeof value !== 'string') return 'Unknown';
  const words = value
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
