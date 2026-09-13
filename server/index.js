import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditUrl } from '../lib/audit.js';

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
  next();
});

function rateLimited(req) {
  const key = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const item = buckets.get(key) || { count: 0, reset: now + 60_000 };
  if (now > item.reset) item.count = 0, item.reset = now + 60_000;
  item.count += 1;
  buckets.set(key, item);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return item.count > 20;
}

app.post('/api/audit', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (rateLimited(req)) return res.status(429).json({ error: 'Muitas análises. Tente novamente em alguns segundos.' });
  const { url } = req.body || {};
  if (typeof url !== 'string' || url.trim().length === 0 || url.length > 2048) return res.status(400).json({ error: 'Informe uma URL válida.' });
  try {
    return res.json(await auditUrl(url.trim()));
  } catch (e) {
    return res.status(502).json({ error: e?.message || 'Não foi possível acessar o site informado.' });
  }
});

app.use(express.static(root, { index: 'index.html' }));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'index.html')));
app.listen(port, () => console.log(`COSTA running on http://localhost:${port}`));
