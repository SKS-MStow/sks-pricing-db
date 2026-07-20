/* Mock field-api for local preview: serves src/ statically plus an in-memory
   /api/pricing + /api/auth/me contract.
   Run: node dev/mock-api-server.js src [port]                              */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(process.argv[2] || 'src');
const PORT = parseInt(process.argv[3], 10) || 4175;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

const SUPPLIERS = [
  { id: 1, name: 'Crestron ANZ' }, { id: 2, name: 'MadisonAV' }, { id: 3, name: 'Jands' },
  { id: 4, name: 'Amber Technology' }, { id: 5, name: 'Westan' },
];
let seq = 100;
function it(supplier_id, brand, sku, description, category, cost, short) {
  return { id: ++seq, supplier_id, brand, sku, description, short_description: short || sku, category, source_category: category, cost_price: String(cost), list_price: null, uom: 'each', imported_at: '2026-07-01T00:00:00Z', raw: {}, supplier_name: SUPPLIERS.find(s => s.id === supplier_id).name, revision_label: 'Jul 2026', revision_imported_at: '2026-07-01T00:00:00Z' };
}
const ITEMS = [
  it(1, 'Crestron', '6510814', '10.1 in. Touch Screen, Black Smooth', 'Control & Automation', 1180, 'TSW-1070-B-S'),
  it(1, 'Crestron', '6508033', 'Saros Soundbar 200, Black', 'Audio', 435, 'SB-200-P-B'),
  it(2, 'Sennheiser', 'TCC2', 'TeamConnect Ceiling 2 Microphone Array', 'Audio', 3890),
  it(3, 'Blustream', 'HDMI18G2', 'Blustream Precision HDMI2.0 Cable 2m', 'Cabling & Connectivity', 40.77),
  it(4, 'Biamp', '910.0301.900', 'Biamp TesiraFORTE AI Fixed Audio DSP', 'Audio', 2364.5),
  it(5, 'Epson', 'EB-PU1007W', 'Epson 7,000lm WUXGA Laser Projector, White', 'Video & Displays', 4980),
];
for (let i = 1; i <= 60; i++) ITEMS.push(it(3, 'Kordz', `PRO3-HD-${i}M`, `Kordz PRO3 High Speed HDMI Cable ${i}m`, 'Cabling & Connectivity', 20 + i * 3.5));

function send(res, code, body, type = 'application/json') {
  const buf = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function api(req, res, url) {
  const p = url.pathname.replace(/^\/api/, '');
  if (p === '/auth/me') return send(res, 200, { user: { id: 42, username: 'mark', name: 'Mark Stow', role: 'admin', allowed_apps: ['pricing'] } });
  if (p === '/pricing/freshness') {
    const ages = { 1: 12, 2: 65, 3: 130, 4: 200, 5: 380 };
    return send(res, 200, { rows: SUPPLIERS.map(s => {
      const days = ages[s.id] || 90, stale = s.id === 2 ? 45 : 180, ratio = days / stale;
      return { supplier_id: s.id, code: s.name.toUpperCase().replace(/[^A-Z0-9]/g, ''), name: s.name,
        supplier_active: true, revision_id: 100 + s.id, scope_label: s.id === 4 ? 'deal-reg-5' : null,
        revision_label: s.id <= 2 ? 'Jul 2026' : 'Master BoM seed — Jul 2026', imported_at: '2026-07-01T00:00:00Z',
        filename: 'Master BoM (1).xlsx', items: ITEMS.filter(x => x.supplier_id === s.id).length,
        stale_days: stale, days_old: days, status: ratio >= 1 ? 'stale' : ratio >= 0.7 ? 'aging' : 'fresh' };
    }) });
  }
  if (p === '/pricing/suppliers') {
    return send(res, 200, { suppliers: SUPPLIERS.map(s => ({ id: s.id, code: s.name.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      name: s.name, is_active: true, active_items: ITEMS.filter(x => x.supplier_id === s.id).length, revisions: s.id === 1 ? 2 : 1 })) });
  }
  if (p === '/pricing/search') {
    const q = url.searchParams;
    const supplierId = parseInt(q.get('supplier_id'), 10) || null;
    const search = (q.get('search') || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
    const pageSize = Math.min(200, parseInt(q.get('page_size'), 10) || 50);
    let rows = ITEMS.filter(x => !supplierId || x.supplier_id === supplierId);
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      rows = rows.filter(x => tokens.every(t => `${x.description} ${x.short_description} ${x.brand} ${x.sku}`.toLowerCase().includes(t)));
    }
    rows = rows.slice().sort((a, b) => a.description.localeCompare(b.description));
    return send(res, 200, { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, page_size: pageSize });
  }
  if (p === '/pricing/revisions') {
    const sid = parseInt(url.searchParams.get('supplier_id'), 10);
    const items = ITEMS.filter(x => x.supplier_id === sid).length;
    const revs = [{ id: 100 + sid, scope_label: null, revision_label: 'Jul 2026', filename: 'pricelist.xlsx',
      imported_at: '2026-07-01T00:00:00Z', is_active: true, archived_at: null,
      summary: { added: 12, changed: 30, removed: 4, row_count: items }, items }];
    if (sid === 1) revs.push({ id: 90, scope_label: null, revision_label: 'Mar 2026', filename: 'old.xlsx',
      imported_at: '2026-03-01T00:00:00Z', is_active: false, archived_at: '2026-07-01T00:00:00Z',
      summary: { added: 200, changed: 0, removed: 0, row_count: 210 }, items: 210 });
    return send(res, 200, { revisions: revs });
  }
  const cm = p.match(/^\/pricing\/revisions\/(\d+)\/changes$/);
  if (cm) {
    const changes = [
      { change_kind: 'added', sku: 'TSW-1070-B-S', description: '10.1 in. Touch Screen', before: null, after: { cost_price: '1180.00' } },
      { change_kind: 'changed', sku: 'SB-200-P-B', description: 'Saros Soundbar 200', before: { cost_price: '410.00' }, after: { cost_price: '435.00' } },
      { change_kind: 'removed', sku: 'OLD-SKU-1', description: 'Discontinued widget', before: { cost_price: '99.00' }, after: null },
    ];
    return send(res, 200, { changes, total: changes.length, page: 1, page_size: 500 });
  }
  send(res, 404, { error: 'Not found: ' + p });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  let file = path.join(SRC, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(SRC)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
}).listen(PORT, () => console.log(`mock pricing api + static ${SRC} on http://localhost:${PORT}`));
