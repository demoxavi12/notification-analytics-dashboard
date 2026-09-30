import { useCallback, useSyncExternalStore } from 'react';

// Subscribes to a CSS media query. Components re-render only when the query's
// match state flips (i.e. when a breakpoint is crossed), not on every resize.
const useMediaQuery = (query) => {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
};

export default useMediaQuery;
