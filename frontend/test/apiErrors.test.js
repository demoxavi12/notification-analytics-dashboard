import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApiErrorMessage } from '../src/utils/apiErrors.js';

const res = (status, error) => ({ isAxiosError: true, response: { status, data: { success: false, error } } });

test('network and timeout failures get connection messages', () => {
  assert.match(getApiErrorMessage({ isAxiosError: true }), /Unable to reach the server/);
  assert.match(getApiErrorMessage({ isAxiosError: true, code: 'ECONNABORTED' }), /too long/);
});

test('server errors never expose internal details', () => {
  const msg = getApiErrorMessage(res(500, { message: 'MongoServerError: E11000 at db.users', code: 'SERVER_ERROR' }));
  assert.equal(msg, 'The server encountered an error. Please try again shortly.');
});

test('unknown-route 404 hides the internal path', () => {
  const msg = getApiErrorMessage(res(404, { message: 'Route not found: GET /api/internal/thing', code: 'NOT_FOUND' }));
  assert.ok(!msg.includes('/api/'));
  assert.match(msg, /isn’t available/);
});

test('meaningful client errors keep the server message', () => {
  assert.equal(getApiErrorMessage(res(404, { message: 'Event not found', code: 'EVENT_NOT_FOUND' })), 'Event not found');
  assert.equal(getApiErrorMessage(res(401, { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' })), 'Invalid email or password');
  assert.equal(
    getApiErrorMessage(res(403, { message: 'This account has been deactivated.', code: 'ACCOUNT_INACTIVE' })),
    'This account has been deactivated.'
  );
  assert.equal(getApiErrorMessage(res(400, { message: 'Validation error', details: ['Name is required'] })), 'Name is required');
  assert.equal(getApiErrorMessage(res(429, { message: 'Too many requests' })), 'Too many requests');
  assert.equal(getApiErrorMessage(res(400, {}), 'Fallback text'), 'Fallback text');
});
