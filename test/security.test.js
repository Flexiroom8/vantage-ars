import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordPolicy } from '../src/security.js';

test('password policy rejects weak passwords and accepts long passphrases', () => {
  assert.equal(passwordPolicy('short').valid, false);
  assert.equal(passwordPolicy('                ').valid, false);
  assert.equal(passwordPolicy('correct horse battery staple 2026').valid, true);
});
test('password hashing verifies correctly and rejects wrong secrets', () => {
  const hash=hashPassword('correct horse battery staple 2026');
  assert.equal(verifyPassword('correct horse battery staple 2026', hash), true);
  assert.equal(verifyPassword('wrong password', hash), false);
});
