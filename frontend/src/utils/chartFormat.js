// Time-bucket labels for charts built on normalizeTimeline() output.
// Day buckets are UTC calendar days (that's how the API groups them), so they are
// labelled in UTC to avoid off-by-one dates. Hour buckets are shown in local time.
const dayTick = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayFull = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const hourTick = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const hourFull = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const formatBucket = (time, bucket, full = false) => {
  if (bucket === 'hour') return (full ? hourFull : hourTick).format(time);
  return full ? `${dayFull.format(time)} (UTC)` : dayTick.format(time);
};
