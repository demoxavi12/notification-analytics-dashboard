// Helpers for untrusted request input used in MongoDB queries and writes.
const mongoose = require('mongoose');

// Accept plain strings only (never objects/arrays, which could smuggle query
// operators) and cap their length.
const queryString = (value, max = 100) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Match user input literally, not as a regular expression (prevents regex
// injection, wildcard matches and catastrophic backtracking).
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- Pagination -----------------------------------------------------------------------

const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 10000; // deeper offsets are never needed by the UI and only cost skip work

// Positive integer from a query string; anything else (missing, "0", "-1", "2.5",
// "1e9", arrays, objects) is treated as absent.
const positiveIntParam = (value) => {
  // Digits only; arbitrarily large values are clamped by the caller.
  if (typeof value !== 'string' || !/^\d{1,30}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
};

// Safe { page, limit, skip } from ?page=&limit=. Invalid values fall back to the
// defaults and huge values are clamped, so a request can neither error nor dump a
// whole collection.
const parsePagination = (query, { defaultLimit = 10, maxLimit = MAX_PAGE_SIZE } = {}) => {
  const page = Math.min(positiveIntParam(query.page) ?? 1, MAX_PAGE);
  const limit = Math.min(positiveIntParam(query.limit) ?? defaultLimit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

// --- Body fields ----------------------------------------------------------------------

const isObjectId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value);

// Required/optional plain string with a length bound. Returns { value } or { error }.
const stringField = (value, { field, max, required = false }) => {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `${field} is required` } : { value: undefined };
  }
  if (typeof value !== 'string') return { error: `${field} must be a string` };
  const trimmed = value.trim();
  if (required && !trimmed) return { error: `${field} is required` };
  if (trimmed.length > max) return { error: `${field} cannot exceed ${max} characters` };
  return { value: trimmed };
};

// Free-form metadata stays flexible (any JSON object) but bounded, so a single
// document can't carry megabytes of data or pathological nesting.
const METADATA_MAX_BYTES = 16 * 1024;
const METADATA_MAX_DEPTH = 5;

// Walks the (already size-bounded) value: returns an error string for nesting that
// is too deep or for keys MongoDB treats as operators/paths ("$..." or containing ".").
const inspectMetadata = (value, depth = 1) => {
  if (value === null || typeof value !== 'object') return null;
  if (depth > METADATA_MAX_DEPTH) return `metadata cannot be nested deeper than ${METADATA_MAX_DEPTH} levels`;
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) return 'metadata keys cannot start with "$" or contain "."';
    const problem = inspectMetadata(child, depth + 1);
    if (problem) return problem;
  }
  return null;
};

const metadataField = (value) => {
  if (value === undefined || value === null) return { value: {} };
  if (typeof value !== 'object' || Array.isArray(value)) return { error: 'metadata must be a JSON object' };
  if (Buffer.byteLength(JSON.stringify(value)) > METADATA_MAX_BYTES) {
    return { error: `metadata cannot exceed ${METADATA_MAX_BYTES / 1024} KB` };
  }
  const problem = inspectMetadata(value);
  return problem ? { error: problem } : { value };
};

module.exports = {
  queryString,
  escapeRegex,
  parsePagination,
  positiveIntParam,
  isObjectId,
  stringField,
  metadataField,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  METADATA_MAX_BYTES,
  METADATA_MAX_DEPTH,
};
