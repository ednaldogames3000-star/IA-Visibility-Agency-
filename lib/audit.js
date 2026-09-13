import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(Number.isNaN)) return true;
  const [a, b] = p;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
}

function isPrivateIPv6(ip) {
  const v = ip.toLowerCase().split('%')[0];
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') ||
    v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') ||
    v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || net.isIP(host) && (net.isIPv4(host) ? isPrivateIPv4(host) : isPrivateIPv6(host))) {
    throw new Error('Destino não permitido.');
  }
  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => net.isIPv4(address) ? isPrivateIPv4(address) : isPrivateIPv6(address))) {
    throw new Error('Destino não permitido.');
  }
}

function cleanText(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function parseAudit(html, url) {
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const description = cleanText(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || '');
  const h1 = (html.match(/<h1\b/gi) || []).length;
  const canonical = /<link[^>]+rel=["'][^"']*canonical[^"']*["']/i.test(html);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const schema = /application\/ld\+json/i.test(html);
  const robots = /<meta[^>]+name=["']robots["']/i.test(html);
  const og = /property=["']og:title["']/i.test(html);
  const lang = /<html[^>]+lang=["'][^"']+["']/i.test(html);
  const checks = [
    ['HTTPS', url.protocol === 'https:', 'Site servido com HTTPS.'],
    ['Title', !!title, 'Título da página encontrado.'],
    ['Meta description', !!description, 'Descrição meta encontrada.'],
    ['H1', h1 === 1, h1 ? `${h1} H1 encontrado(s).` : 'Nenhum H1 encontrado.'],
    ['Viewport', viewport, 'Meta viewport encontrada.'],
    ['Canonical', canonical, canonical ? 'Canonical encontrado.' : 'Canonical ausente.'],
    ['Schema', schema, schema ? 'Dados estruturados encontrados.' : 'JSON-LD não encontrado.'],
    ['Open Graph', og, og ? 'OG title encontrado.' : 'Open Graph básico ausente.'],
    ['Robots meta', robots, robots ? 'Robots meta encontrado.' : 'Robots meta não encontrado.'],
    ['HTML lang', lang, lang ? 'Idioma do documento declarado.' : 'Atributo lang ausente.']
  ];
  const score = Math.round(checks.reduce((n, [, ok]) => n + (ok ? 1 : 0), 0) / checks.length * 100);
  return { ok: true, url: url.href, fetchedAt: new Date().toISOString(), score, title, description, checks };
}

export async function auditUrl(input) {
  let current;
  try { current = new URL(input); } catch { throw new Error('URL inválida.'); }
  if (!ALLOWED_PROTOCOLS.has(current.protocol)) throw new Error('Use http ou https.');

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    await assertPublicHost(current.hostname);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'COSTA-Audit/1.1 (+https://github.com/ednaldogames3000-star/IA-Visibility-Agency-)',
          'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
        }
      });
    } finally { clearTimeout(timer); }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirecionamento inválido.');
      current = new URL(location, current.href);
      if (!ALLOWED_PROTOCOLS.has(current.protocol)) throw new Error('Redirecionamento para protocolo não permitido.');
      continue;
    }
    if (!response.ok) throw new Error(`O site respondeu com HTTP ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (type && !/text\/html|application\/xhtml\+xml/i.test(type)) throw new Error('O endereço não retornou uma página HTML.');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('A página é grande demais para esta análise.');

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error('A página é grande demais para esta análise.');
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    return parseAudit(html, current);
  }
  throw new Error('Número máximo de redirecionamentos excedido.');
}
