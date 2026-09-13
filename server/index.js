import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditUrl } from '../lib/audit.js';
import { listAudits, saveAudit } from '../lib/store.js';
import { requireAdmin, signAdminToken, verifyAdminCredentials } from '../lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = process.env.PORT || 3000;
const buckets = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}
function rateLimited(req, limit = 20) {
  const key = clientKey(req);
  const now = Date.now();
  const item = buckets.get(key) || { count: 0, reset: now + 60_000 };
  if (now > item.reset) item.count = 0, item.reset = now + 60_000;
  item.count += 1;
  buckets.set(key, item);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return item.count > limit;
}

app.post('/api/auth/login', (req, res) => {
  if (rateLimited(req, 10)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  const { username, password } = req.body || {};
  if (!verifyAdminCredentials(username, password)) return res.status(401).json({ error: 'Credenciais inválidas.' });
  try { return res.json({ token: signAdminToken(username) }); }
  catch { return res.status(503).json({ error: 'Autenticação administrativa não configurada.' }); }
});

app.post('/api/audit', async (req, res) => {
  if (rateLimited(req, 20)) return res.status(429).json({ error: 'Muitas análises. Tente novamente em alguns segundos.' });
  const { url } = req.body || {};
  if (typeof url !== 'string' || url.trim().length === 0 || url.length > 2048) return res.status(400).json({ error: 'Informe uma URL válida.' });
  try {
    const result = await auditUrl(url.trim());
    const auditId = saveAudit(result);
    return res.json({ ...result, auditId });
  } catch (e) {
    return res.status(502).json({ error: e?.message || 'Não foi possível acessar o site informado.' });
  }
});

app.get('/api/admin/audits', requireAdmin, (req, res) => res.json({ audits: listAudits(req.query.limit) }));

app.use(express.static(root, { index: 'index.html' }));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`COSTA running on http://localhost:${port}`));

export { app };
