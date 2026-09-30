import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../services/api';

// Runs `fetcher(params, { signal })` whenever `params` (by value) changes or
// `reload()` is called. Guarantees:
//  - only the latest request can update state (older ones are aborted and ignored)
//  - previous results stay visible (dimmed) while a new page/filter loads
//  - loading is derived from "does the stored result match the current request",
//    so no state is set synchronously inside the effect.
//
// fetcher must resolve to { items, pagination, meta? } or throw an axios error.
const usePaginatedQuery = (fetcher, params, fallbackMessage = 'Could not load data.') => {
  const key = JSON.stringify(params);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState({ key: null, nonce: -1, data: null, error: null, isNetworkError: false });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetcher(JSON.parse(key), { signal: controller.signal }).then(
      (data) => {
        if (!cancelled) setResult({ key, nonce, data, error: null, isNetworkError: false });
      },
      (err) => {
        if (cancelled) return;
        // Drop old data on failure: it may belong to different filters, and a retry
        // should show a loading skeleton rather than resurrecting stale rows.
        setResult({
          key,
          nonce,
          data: null,
          error: getApiErrorMessage(err, fallbackMessage),
          isNetworkError: Boolean(err?.isAxiosError && !err.response),
        });
      }
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, key, nonce, fallbackMessage]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Local optimistic edits (e.g. mark-as-read) without refetching.
  const updateData = useCallback((updater) => {
    setResult((prev) => (prev.data ? { ...prev, data: updater(prev.data) } : prev));
  }, []);

  const isCurrent = result.key === key && result.nonce === nonce;
  const status = !isCurrent ? 'loading' : result.error ? 'error' : 'success';

  return {
    status,
    data: result.data,
    error: isCurrent ? result.error : null,
    isNetworkError: isCurrent && result.isNetworkError,
    isRefreshing: status === 'loading' && result.data !== null,
    reload,
    updateData,
  };
};

export default usePaginatedQuery;
