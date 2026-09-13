import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const jwtSecret = () => process.env.JWT_SECRET;
const adminUser = () => process.env.ADMIN_USER || 'admin';
const adminPasswordHash = () => process.env.ADMIN_PASSWORD_HASH;

function requiredSecret() {
  const secret = jwtSecret();
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET ausente ou fraco.');
  return secret;
}

export function verifyAdminCredentials(username, password) {
  try {
    const storedHash = adminPasswordHash();
    if (!storedHash || typeof username !== 'string' || typeof password !== 'string') return false;
    if (username !== adminUser()) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, stored] = parts;
    if (!/^[0-9a-f]{32}$/i.test(salt) || !/^[0-9a-f]{128}$/i.test(stored)) return false;
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(stored, 'hex'));
  } catch {
    return false;
  }
}

export function signAdminToken(username) {
  const secret = requiredSecret();
  return jwt.sign({ sub: username, role: 'admin' }, secret, {
    expiresIn: '2h', issuer: 'costa-visibility-agency', audience: 'costa-admin'
  });
}

export function requireAdmin(req, res, next) {
  try {
    const secret = requiredSecret();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || token.length > 4096) throw new Error('missing token');
    const payload = jwt.verify(token, secret, {
      issuer: 'costa-visibility-agency', audience: 'costa-admin'
    });
    if (payload.role !== 'admin' || typeof payload.sub !== 'string') throw new Error('forbidden');
    req.admin = payload;
    return next();
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
