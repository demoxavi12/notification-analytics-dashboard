// Turn an axios-style error into a user-facing message, distinguishing
// network/timeout/rate-limit/server failures from API validation errors.
// Server messages are shown for expected client errors (validation, "Event not
// found", "Invalid email or password"), but internal details are never surfaced:
// 5xx responses and the generic unknown-route 404 get neutral wording instead.
export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
      return 'The server took too long to respond. Please try again.';
    }
    return 'Unable to reach the server. Check your connection and try again.';
  }

  const { status, data } = error.response;
  const code = data?.error?.code;

  if (status === 429) {
    return data?.error?.message || 'Too many attempts. Please wait a moment and try again.';
  }
  if (status >= 500) {
    return 'The server encountered an error. Please try again shortly.';
  }
  // Unknown route (e.g. frontend and API versions out of sync): the server message
  // contains the internal path, which is meaningless (and leaky) for users.
  if (status === 404 && code === 'NOT_FOUND') {
    return 'This feature isn’t available on the server right now. Please try again later.';
  }

  const details = data?.error?.details;
  if (Array.isArray(details) && details.length > 0 && typeof details[0] === 'string') {
    return details.join(' ');
  }

  return data?.error?.message || fallback;
};
