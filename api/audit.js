import { auditUrl } from '../lib/audit.js';

const buckets = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 20;

function clientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  return String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(key) {
  const now = Date.now();
  const current = buckets.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (now > current.reset) current.count = 0, current.reset = now + WINDOW_MS;
  current.count += 1;
  buckets.set(key, current);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  return current.count > LIMIT;
}

function secureHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

export default async function handler(req, res) {
  secureHeaders(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (rateLimited(clientKey(req))) return res.status(429).json({ error: 'Muitas análises. Tente novamente em alguns segundos.' });

  const { url } = req.body || {};
  if (typeof url !== 'string' || url.length > 2048) return res.status(400).json({ error: 'Informe uma URL válida.' });

  try {
    const result = await auditUrl(url.trim());
    return res.status(200).json(result);
  } catch (e) {
    const message = e?.name === 'AbortError' ? 'O site demorou demais para responder.' : (e?.message || 'Não foi possível acessar o site informado.');
    return res.status(502).json({ error: message });
  }
}
