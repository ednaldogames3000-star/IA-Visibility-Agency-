import test from 'node:test';
import assert from 'node:assert/strict';
import { auditUrl } from '../lib/audit.js';

test('rejects invalid protocols', async () => {
  await assert.rejects(() => auditUrl('file:///etc/passwd'), /Use http ou https/);
});

test('rejects localhost', async () => {
  await assert.rejects(() => auditUrl('http://localhost:3000'), /Destino não permitido/);
});

test('rejects private IPv4', async () => {
  await assert.rejects(() => auditUrl('http://127.0.0.1'), /Destino não permitido/);
});

test('rejects malformed URLs', async () => {
  await assert.rejects(() => auditUrl('not-a-url'), /URL inválida/);
});
