import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.ADMIN_USER = 'admin';

const { createPasswordHash, verifyAdminCredentials, signAdminToken } = await import('../lib/auth.js');

const password = 'test-password-1234';
process.env.ADMIN_PASSWORD_HASH = createPasswordHash(password);

test('accepts the configured admin credentials', () => {
  assert.equal(verifyAdminCredentials('admin', password), true);
  assert.equal(verifyAdminCredentials('admin', 'wrong-password'), false);
});

test('issues a JWT for an authenticated admin', () => {
  const token = signAdminToken('admin');
  assert.equal(typeof token, 'string');
  assert.ok(token.split('.').length === 3);
});
