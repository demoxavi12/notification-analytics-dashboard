import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { liveDashboardSource } from './liveDashboardSource';
import {
  DEFAULT_RANGE,
  normalizeDistributions,
  normalizeEventList,
  normalizeNotificationList,
  normalizeOverview,
  normalizeTimeline,
} from './dashboardModel';

// Section state: { status: 'loading' | 'success' | 'error', raw, error, isNetworkError }.
// `raw` is undefined until a request succeeds (null = succeeded but payload missing,
// which normalizes to an empty section rather than a blank box). It survives a
// reload so refreshes don't flash back to skeletons.
const LOADING = { status: 'loading', raw: undefined, error: null, isNetworkError: false };

const toLoading = (section) => ({ ...(section || LOADING), status: 'loading', error: null });

const fromResult = (result) =>
  result.ok
    ? { status: 'success', raw: result.data ?? null, error: null, isNetworkError: false }
    : { status: 'error', raw: undefined, error: result.error, isNetworkError: result.isNetworkError };

const markAllLoading = (sections) =>
  Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, toLoading(value)]));

const INITIAL_RANGE_SECTIONS = { overview: LOADING, timeline: LOADING, distributions: LOADING };
const INITIAL_RECENT_SECTIONS = { events: LOADING, notifications: LOADING };

export const DEMO_MODE_AVAILABLE = import.meta.env.DEV;

const useDashboardData = ({ isAdmin, onUnreadCountChange }) => {
  const [source, setSource] = useState(liveDashboardSource);
  const [range, setRangeState] = useState(DEFAULT_RANGE);
  // Changing either key object re-runs the matching fetch effect.
  const [rangeRequest, setRangeRequest] = useState({ range: DEFAULT_RANGE, nonce: 0 });
  const [recentRequest, setRecentRequest] = useState({ nonce: 0 });
  const [rangeSections, setRangeSections] = useState(INITIAL_RANGE_SECTIONS);
  const [recentSections, setRecentSections] = useState(INITIAL_RECENT_SECTIONS);
  const [loadedRange, setLoadedRange] = useState(DEFAULT_RANGE);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [simulation, setSimulation] = useState({ status: 'idle', message: '' });
  const [actionError, setActionError] = useState('');
  const simulatingRef = useRef(false);

  // Range-scoped sections (KPIs, timeline, breakdowns).
  useEffect(() => {
    let cancelled = false; // drops responses from a superseded request
    source.fetchRangeSections(rangeRequest.range).then((result) => {
      if (cancelled) return;
      setRangeSections({
        overview: fromResult(result.overview),
        timeline: fromResult(result.timeline),
        distributions: fromResult(result.distributions),
      });
      setLoadedRange(rangeRequest.range);
      // Only claim "updated" when something actually loaded.
      if (result.overview.ok || result.timeline.ok || result.distributions.ok) setLastUpdated(Date.now());
    });
    return () => {
      cancelled = true;
    };
  }, [source, rangeRequest]);

  // Recent activity (not range-scoped, so a range change doesn't refetch it).
  useEffect(() => {
    let cancelled = false;
    source.fetchRecentActivity().then((result) => {
      if (cancelled) return;
      setRecentSections({ events: fromResult(result.events), notifications: fromResult(result.notifications) });
    });
    return () => {
      cancelled = true;
    };
  }, [source, recentRequest]);

  const setRange = useCallback(
    (nextRange) => {
      if (nextRange === range) return;
      setRangeState(nextRange);
      setRangeSections(markAllLoading);
      setRangeRequest({ range: nextRange, nonce: Date.now() });
    },
    [range]
  );

  const refresh = useCallback(() => {
    setRangeSections(markAllLoading);
    setRecentSections(markAllLoading);
    setRangeRequest((prev) => ({ ...prev, nonce: prev.nonce + 1 }));
    setRecentRequest((prev) => ({ nonce: prev.nonce + 1 }));
  }, []);

  const switchSource = useCallback((nextSource) => {
    setRangeSections(markAllLoading);
    setRecentSections(markAllLoading);
    setSimulation({ status: 'idle', message: '' });
    setActionError('');
    setSource(nextSource);
  }, []);

  const enableDemoMode = useCallback(() => {
    if (!DEMO_MODE_AVAILABLE) return;
    // Dynamic import keeps the demo generator out of the main (and production) bundle.
    import('./demoDashboardSource').then(({ createDemoDashboardSource }) => {
      switchSource(createDemoDashboardSource({ isAdmin }));
    });
  }, [isAdmin, switchSource]);

  const disableDemoMode = useCallback(() => switchSource(liveDashboardSource), [switchSource]);

  const markNotificationRead = useCallback(
    async (id) => {
      setActionError('');
      const setRead = (read) =>
        setRecentSections((prev) => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            raw: prev.notifications.raw?.map((n) => (n._id === id ? { ...n, read } : n)),
          },
        }));

      setRead(true); // optimistic
      const result = await source.markNotificationRead(id);
      if (!result.ok) {
        setRead(false);
        setActionError(result.error);
      } else if (source.kind === 'live') {
        onUnreadCountChange?.();
      }
    },
    [source, onUnreadCountChange]
  );

  const simulateEvent = useCallback(
    async (serviceType, label) => {
      if (simulatingRef.current) return;
      simulatingRef.current = true;
      setSimulation({ status: 'pending', message: `Sending ${label}…` });
      const result = await source.simulateEvent(serviceType);
      simulatingRef.current = false;
      if (result.ok) {
        setSimulation({ status: 'success', message: `${label} recorded. Dashboard refreshed.` });
        refresh();
        onUnreadCountChange?.();
      } else {
        setSimulation({ status: 'error', message: result.error });
      }
    },
    [source, refresh, onUnreadCountChange]
  );

  // Normalization is memoized: it only re-runs when the underlying payload changes.
  const overview = useMemo(
    () => (rangeSections.overview.raw !== undefined ? normalizeOverview(rangeSections.overview.raw, { isAdmin }) : null),
    [rangeSections.overview.raw, isAdmin]
  );
  const timeline = useMemo(
    () => (rangeSections.timeline.raw !== undefined ? normalizeTimeline(rangeSections.timeline.raw, loadedRange) : null),
    [rangeSections.timeline.raw, loadedRange]
  );
  const distributions = useMemo(
    () => (rangeSections.distributions.raw !== undefined ? normalizeDistributions(rangeSections.distributions.raw) : null),
    [rangeSections.distributions.raw]
  );
  const recentEvents = useMemo(
    () => (recentSections.events.raw !== undefined ? normalizeEventList(recentSections.events.raw) : null),
    [recentSections.events.raw]
  );
  const recentNotifications = useMemo(
    () => (recentSections.notifications.raw !== undefined ? normalizeNotificationList(recentSections.notifications.raw) : null),
    [recentSections.notifications.raw]
  );

  const allSections = [...Object.values(rangeSections), ...Object.values(recentSections)];
  const isRefreshing = allSections.some((s) => s.status === 'loading');
  const backendUnreachable = allSections.some((s) => s.status === 'error' && s.isNetworkError);

  return {
    range,
    loadedRange,
    setRange,
    refresh,
    isRefreshing,
    lastUpdated,
    mode: source.kind,
    canUseDemoMode: DEMO_MODE_AVAILABLE && source.kind === 'live' && backendUnreachable,
    enableDemoMode,
    disableDemoMode,
    sections: {
      overview: { ...rangeSections.overview, data: overview },
      timeline: { ...rangeSections.timeline, data: timeline },
      distributions: { ...rangeSections.distributions, data: distributions },
      recentEvents: { ...recentSections.events, data: recentEvents },
      recentNotifications: { ...recentSections.notifications, data: recentNotifications },
    },
    markNotificationRead,
    actionError,
    simulateEvent,
    simulation,
  };
};

export default useDashboardData;
