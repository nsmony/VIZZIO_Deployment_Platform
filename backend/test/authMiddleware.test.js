import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from '../src/middleware/authMiddleware.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('requireAdmin allows an admin role regardless of role casing', () => {
  const response = createResponse();
  let nextCalled = false;

  requireAdmin({ user: { role: 'Admin' } }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, null);
});

test('requireAdmin rejects an authenticated non-admin user', () => {
  const response = createResponse();
  let nextCalled = false;

  requireAdmin({ user: { role: 'user' } }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'Admin access required.' });
});

test('requireAdmin rejects a request without a role claim', () => {
  const response = createResponse();

  requireAdmin({ user: {} }, response, () => {
    assert.fail('next should not be called');
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'Admin access required.' });
});
