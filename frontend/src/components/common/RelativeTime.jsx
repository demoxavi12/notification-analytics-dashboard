import { formatDateTime, formatRelativeTime, toDate } from '../../utils/formatters';

// "5 minutes ago" for scanning; exact local time in the tooltip and in the
// machine-readable dateTime attribute. Pass `now` from useNow() to keep it fresh.
const RelativeTime = ({ value, now, className }) => {
  const date = toDate(value);
  if (!date) return <span className={className}>Unknown time</span>;
  return (
    <time className={className} dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatRelativeTime(date, now)}
    </time>
  );
};

export default RelativeTime;
