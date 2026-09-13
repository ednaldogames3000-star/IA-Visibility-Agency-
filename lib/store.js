import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = connectionString ? new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX || 10), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } }) : null;
let initialized = false;

export function hasDatabase() { return Boolean(pool); }

export async function initStore() {
  if (!pool || initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, company TEXT, email TEXT, phone TEXT,
      status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','active','inactive','lost')),
      notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
    CREATE TABLE IF NOT EXISTS audits (
      id UUID PRIMARY KEY, customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
      url TEXT NOT NULL, score INTEGER, result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audits_customer ON audits(customer_id);
    CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
    CREATE TABLE IF NOT EXISTS leads (
      id BIGSERIAL PRIMARY KEY, name TEXT, company TEXT, email TEXT, phone TEXT, source TEXT,
      message TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','lost')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
    CREATE TABLE IF NOT EXISTS app_logs (
      id BIGSERIAL PRIMARY KEY, level TEXT NOT NULL, event TEXT NOT NULL, request_id TEXT, actor TEXT,
      metadata JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON app_logs(created_at DESC);
  `);
  initialized = true;
}

function requireDb() { if (!pool) throw new Error('Banco PostgreSQL não configurado.'); return pool; }
function safeLimit(value, fallback, max) { return Math.min(Math.max(Number(value) || fallback, 1), max); }

export async function saveAudit(result, customerId = null) {
  const db = requireDb(); await initStore();
  const id = crypto.randomUUID();
  await db.query('INSERT INTO audits (id,customer_id,url,score,result) VALUES ($1,$2,$3,$4,$5)', [id, customerId || null, result.url, result.score ?? null, JSON.stringify(result)]);
  return id;
}

export async function listAudits(limit = 50) {
  const db = requireDb(); await initStore();
  const { rows } = await db.query('SELECT id,customer_id AS "customerId",url,score,result,created_at AS "createdAt" FROM audits ORDER BY created_at DESC LIMIT $1', [safeLimit(limit, 50, 100)]);
  return rows;
}

export async function createCustomer(data) {
  const db = requireDb(); await initStore();
  const { rows } = await db.query('INSERT INTO customers (name,company,email,phone,status,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,company,email,phone,status,notes,created_at AS "createdAt",updated_at AS "updatedAt"', [data.name, data.company || null, data.email || null, data.phone || null, data.status || 'lead', data.notes || null]);
  return rows[0];
}

export async function listCustomers(limit = 100) {
  const db = requireDb(); await initStore();
  const { rows } = await db.query('SELECT id,name,company,email,phone,status,notes,created_at AS "createdAt",updated_at AS "updatedAt" FROM customers ORDER BY created_at DESC LIMIT $1', [safeLimit(limit, 100, 200)]);
  return rows;
}

export async function createLead(data) {
  const db = requireDb(); await initStore();
  const { rows } = await db.query('INSERT INTO leads (name,company,email,phone,source,message) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,company,email,phone,source,message,status,created_at AS "createdAt",updated_at AS "updatedAt"', [data.name || null, data.company || null, data.email || null, data.phone || null, data.source || 'site', data.message || null]);
  return rows[0];
}

export async function listLeads(limit = 100) {
  const db = requireDb(); await initStore();
  const { rows } = await db.query('SELECT id,name,company,email,phone,source,message,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM leads ORDER BY created_at DESC LIMIT $1', [safeLimit(limit, 100, 200)]);
  return rows;
}

export async function addLog(level, event, metadata = {}, requestId = null, actor = null) {
  if (!pool) return;
  await initStore();
  await pool.query('INSERT INTO app_logs (level,event,request_id,actor,metadata) VALUES ($1,$2,$3,$4,$5)', [level, event, requestId, actor, JSON.stringify(metadata)]);
}

export async function listLogs(limit = 100) {
  const db = requireDb(); await initStore();
  const { rows } = await db.query('SELECT id,level,event,request_id AS "requestId",actor,metadata,created_at AS "createdAt" FROM app_logs ORDER BY created_at DESC LIMIT $1', [safeLimit(limit, 100, 200)]);
  return rows;
}

export async function getStats() {
  const db = requireDb(); await initStore();
  const { rows } = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM customers) AS customers,
    (SELECT COUNT(*)::int FROM audits) AS audits,
    (SELECT COUNT(*)::int FROM leads) AS leads,
    (SELECT COUNT(*)::int FROM leads WHERE status='new') AS new_leads,
    (SELECT COUNT(*)::int FROM app_logs) AS logs`);
  return { customers: rows[0].customers, audits: rows[0].audits, leads: rows[0].leads, newLeads: rows[0].new_leads, logs: rows[0].logs };
}

export async function getHealth() {
  if (!pool) return { database: 'not_configured' };
  await initStore();
  const { rows } = await pool.query('SELECT NOW() AS now');
  return { database: 'ok', now: rows[0].now };
}
