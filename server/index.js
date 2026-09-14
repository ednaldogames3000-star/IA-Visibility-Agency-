import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditUrl } from '../lib/audit.js';
import { addLog, createCustomer, createLead, getHealth, getStats, hasDatabase, listAudits, listCustomerAudits, listCustomers, listLeads, listLogs, saveAudit } from '../lib/store.js';
import { clearAdminCookie, getAdminCookie, requireAdmin, signAdminToken, verifyAdminCredentials } from '../lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = process.env.PORT || 3000;
const buckets = new Map();
const startedAt = Date.now();

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

function clientKey(req) { return req.ip || req.socket.remoteAddress || 'unknown'; }
function rateLimited(req, limit = 20) {
  const key = clientKey(req); const now = Date.now();
  const item = buckets.get(key) || { count: 0, reset: now + 60_000 };
  if (now > item.reset) { item.count = 0; item.reset = now + 60_000; }
  item.count += 1; buckets.set(key, item);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return item.count > limit;
}
function cleanText(value, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function validEmail(value) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
function publicAssetAllowed(urlPath) {
  let normalized; try { normalized = decodeURIComponent(urlPath || '/'); } catch { return false; }
  const blocked = /(^|\/)(lib|server|tests|node_modules|\.git|\.github|db|api)(\/|$)|(^|\/)(package(?:-lock)?\.json|README\.md|vercel\.json|\.env(?:\.|$))/i;
  return !blocked.test(normalized);
}

app.get('/api/health', asyncRoute(async (req, res) => {
  const health = await getHealth();
  res.status(health.database === 'ok' ? 200 : 503).json({ status: health.database === 'ok' ? 'ok' : 'degraded', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), ...health, requestId: req.requestId });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  if (rateLimited(req, 10)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  const { username, password } = req.body || {};
  if (!verifyAdminCredentials(username, password)) return res.status(401).json({ error: 'Credenciais inválidas.' });
  if (!hasDatabase()) return res.status(503).json({ error: 'Banco PostgreSQL não configurado.' });
  const token = signAdminToken(username);
  res.setHeader('Set-Cookie', getAdminCookie(token));
  await addLog('info', 'admin.login', {}, req.requestId, username);
  return res.json({ authenticated: true, expiresIn: 7200 });
}));

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearAdminCookie());
  return res.json({ authenticated: false });
});

app.post('/api/audit', asyncRoute(async (req, res) => {
  if (rateLimited(req, 20)) return res.status(429).json({ error: 'Muitas análises. Tente novamente em alguns segundos.' });
  const { url } = req.body || {};
  if (typeof url !== 'string' || !url.trim() || url.length > 2048) return res.status(400).json({ error: 'Informe uma URL válida.' });
  const result = await auditUrl(url.trim());
  const auditId = await saveAudit(result);
  await addLog('info', 'audit.created', { auditId, url: result.url, score: result.score }, req.requestId);
  return res.json({ ...result, auditId });
}));

app.post('/api/leads', asyncRoute(async (req, res) => {
  if (rateLimited(req, 10)) return res.status(429).json({ error: 'Muitas solicitações. Tente novamente mais tarde.' });
  const body = req.body || {};
  const name = cleanText(body.name, 120);
  const company = cleanText(body.company, 160);
  const email = cleanText(body.email, 254);
  const phone = cleanText(body.phone, 40);
  const source = cleanText(body.source, 80) || 'site';
  const message = cleanText(body.message, 2000);
  if (!name || (!email && !phone) || !validEmail(email)) return res.status(400).json({ error: 'Informe nome e pelo menos um contato válido.' });
  const lead = await createLead({ name, company, email, phone, source, message });
  await addLog('info', 'lead.created', { leadId: lead.id, source: lead.source }, req.requestId);
  return res.status(201).json({ id: lead.id, status: lead.status });
}));

app.use('/api/admin', requireAdmin);
app.get('/api/admin/stats', asyncRoute(async (_req, res) => res.json(await getStats())));
app.get('/api/admin/audits', asyncRoute(async (req, res) => res.json({ audits: await listAudits(req.query.limit) })));
app.get('/api/admin/customers', asyncRoute(async (req, res) => res.json({ customers: await listCustomers(req.query.limit) })));
app.get('/api/admin/customers/:id/audits', asyncRoute(async (req, res) => res.json({ audits: await listCustomerAudits(req.params.id, req.query.limit) })));
app.post('/api/admin/customers', asyncRoute(async (req, res) => {
  const body = req.body || {}; const name = cleanText(body.name, 120); const email = cleanText(body.email, 254);
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  const customer = await createCustomer({ name, company: cleanText(body.company, 160), email, phone: cleanText(body.phone, 40), status: cleanText(body.status, 20) || 'lead', notes: cleanText(body.notes, 3000) });
  await addLog('info', 'customer.created', { customerId: customer.id }, req.requestId, req.admin.sub);
  return res.status(201).json(customer);
}));
app.get('/api/admin/leads', asyncRoute(async (req, res) => res.json({ leads: await listLeads(req.query.limit) })));
app.get('/api/admin/logs', asyncRoute(async (req, res) => res.json({ logs: await listLogs(req.query.limit) })));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!publicAssetAllowed(req.path)) return res.status(404).send('Not found');
  next();
});
app.use(express.static(root, { index: 'index.html', dotfiles: 'deny' }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || !publicAssetAllowed(req.path)) return res.status(404).send('Not found');
  res.sendFile(path.join(root, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error(`[${req.requestId}]`, err);
  addLog('error', 'request.error', { message: err?.message || 'unknown', path: req.path }, req.requestId).catch(() => {});
  const status = err?.type === 'entity.too.large' ? 413 : 500;
  res.status(status).json({ error: status === 413 ? 'Requisição muito grande.' : 'Erro interno.', requestId: req.requestId });
});

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`COSTA running on port ${port}`));

export { app };
