import fs from 'node:fs';
import path from 'node:path';

const storePath = process.env.AUDIT_STORE_PATH || path.resolve(process.cwd(), 'data/audits.jsonl');

function ensureStore() {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, '', 'utf8');
}

export function saveAudit(result) {
  ensureStore();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const record = { id, createdAt: new Date().toISOString(), ...result };
  fs.appendFileSync(storePath, JSON.stringify(record) + '\n', 'utf8');
  return id;
}

export function listAudits(limit = 50) {
  ensureStore();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const lines = fs.readFileSync(storePath, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-safeLimit).reverse().map(line => JSON.parse(line));
}
