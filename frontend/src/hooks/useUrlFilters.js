import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// Filter/pagination state stored in the URL query string, so it survives navigating
// away and back, can be bookmarked, and works with the browser back button.
//
// `schema` maps each key to { default, values? , type? }:
//   values: allowed strings (anything else falls back to the default)
//   type: 'page' (positive integer) | 'text' (trimmed, max 100 chars)
// Defaults are omitted from the URL to keep it clean.
const parseValue = (raw, spec) => {
  if (raw === null || raw === undefined) return spec.default;
  if (spec.type === 'page') {
    const num = Number.parseInt(raw, 10);
    return Number.isFinite(num) && num >= 1 ? num : spec.default;
  }
  if (spec.type === 'text') return raw.trim().slice(0, 100);
  if (spec.values) return spec.values.includes(raw) ? raw : spec.default;
  return raw;
};

const useUrlFilters = (schema) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = {};
    for (const [key, spec] of Object.entries(schema)) result[key] = parseValue(searchParams.get(key), spec);
    return result;
  }, [searchParams, schema]);

  // Merge a patch into the URL. Any change other than `page` resets to page 1.
  const updateFilters = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const touchesNonPage = Object.keys(patch).some((key) => key !== 'page');
          const merged = { ...patch, ...(touchesNonPage && !('page' in patch) ? { page: 1 } : {}) };
          for (const [key, value] of Object.entries(merged)) {
            const spec = schema[key];
            if (!spec) continue;
            if (value === spec.default || value === '' || value === null || value === undefined) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: false }
      );
    },
    [schema, setSearchParams]
  );

  const resetFilters = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams]);

  const activeFilterCount = useMemo(
    () => Object.entries(schema).filter(([key, spec]) => key !== 'page' && key !== 'limit' && filters[key] !== spec.default).length,
    [filters, schema]
  );

  return { filters, updateFilters, resetFilters, activeFilterCount };
};

export default useUrlFilters;
