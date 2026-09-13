import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

function requiredSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET ausente ou fraco.');
}

export function verifyAdminCredentials(username, password) {
  if (!ADMIN_PASSWORD_HASH || typeof username !== 'string' || typeof password !== 'string') return false;
  if (username !== ADMIN_USER) return false;
  const [salt, stored] = ADMIN_PASSWORD_HASH.split(':');
  if (!salt || !stored) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(stored, 'hex'));
}

export function signAdminToken(username) {
  requiredSecret();
  return jwt.sign({ sub: username, role: 'admin' }, JWT_SECRET, { expiresIn: '2h', issuer: 'costa-visibility-agency', audience: 'costa-admin' });
}

export function requireAdmin(req, res, next) {
  try {
    requiredSecret();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'costa-visibility-agency', audience: 'costa-admin' });
    if (payload.role !== 'admin') throw new Error('forbidden');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
}

export function createPasswordHash(password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('A senha deve ter pelo menos 12 caracteres.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
