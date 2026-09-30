import { useEffect, useState } from 'react';

// Current time, refreshed on an interval, so relative labels ("5 minutes ago")
// stay accurate without refetching data. One timer per consumer.
const useNow = (intervalMs = 60000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export default useNow;
