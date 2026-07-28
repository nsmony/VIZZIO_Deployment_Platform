import test from 'node:test';
import assert from 'node:assert/strict';
import { changePassword } from '../src/controllers/authController.js';

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

test('changePassword requires both password fields', async () => {
  const response = createResponse();
  await changePassword({ body: {}, user: { userId: 'admin-id' } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'Current password and new password are required.' });
});

test('changePassword enforces the minimum password length', async () => {
  const response = createResponse();
  await changePassword({
    body: { currentPassword: 'old-password', newPassword: 'short' },
    user: { userId: 'admin-id' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'New password must be at least 8 characters.' });
});

test('changePassword rejects reusing the current password', async () => {
  const response = createResponse();
  await changePassword({
    body: { currentPassword: 'same-password', newPassword: 'same-password' },
    user: { userId: 'admin-id' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: 'New password must be different from the current password.' });
});
