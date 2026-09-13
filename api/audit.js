export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Informe uma URL.' });
  let target;
  try { target = new URL(url); } catch { return res.status(400).json({ error: 'URL inválida.' }); }
  if (!/^https?:$/.test(target.protocol)) return res.status(400).json({ error: 'Use http ou https.' });
  try {
    const response = await fetch(target.href, { redirect: 'follow', headers: { 'User-Agent': 'COSTA-Audit/1.0' } });
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || '';
    const h1 = (html.match(/<h1\b/gi) || []).length;
    const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const schema = /application\/ld\+json/i.test(html);
    const robots = /<meta[^>]+name=["']robots["']/i.test(html);
    const og = /property=["']og:title["']/i.test(html);
    const https = target.protocol === 'https:';
    const checks = [
      ['HTTPS', https, 'Site servido com HTTPS.'],
      ['Title', !!title, 'Título da página encontrado.'],
      ['Meta description', !!description, 'Descrição meta encontrada.'],
      ['H1', h1 === 1, h1 ? `${h1} H1 encontrado(s).` : 'Nenhum H1 encontrado.'],
      ['Viewport', viewport, 'Meta viewport encontrada.'],
      ['Canonical', canonical, canonical ? 'Canonical encontrado.' : 'Canonical ausente.'],
      ['Schema', schema, schema ? 'Dados estruturados encontrados.' : 'JSON-LD não encontrado.'],
      ['Open Graph', og, og ? 'OG title encontrado.' : 'Open Graph básico ausente.'],
      ['Robots meta', robots, robots ? 'Robots meta encontrado.' : 'Robots meta não encontrado (não é necessariamente um problema).']
    ];
    const score = Math.round(checks.reduce((n, [, ok]) => n + (ok ? 1 : 0), 0) / checks.length * 100);
    return res.status(200).json({ ok: true, url: target.href, fetchedAt: new Date().toISOString(), score, title, description, checks });
  } catch (e) {
    return res.status(502).json({ error: 'Não foi possível acessar o site informado.', detail: e.message });
  }
}