// Helpers for untrusted query-string input used in MongoDB queries.

// Accept plain strings only (never objects/arrays, which could smuggle query
// operators) and cap their length.
const queryString = (value, max = 100) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Match user input literally, not as a regular expression (prevents regex
// injection, wildcard matches and catastrophic backtracking).
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { queryString, escapeRegex };
