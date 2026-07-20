/* SKS Pricing Database — read-only; the AI drives all writes via the MCP
   pricelist flow and this app is the transparent window onto it (Mark,
   20 Jul 2026). Supplier-centric:
     Suppliers — the front door: every supplier's setup + current state,
                 click in for source config, scopes, revisions, activity
     Freshness — traffic-light board per supplier×scope, sortable/filterable
     Catalogue — server-side search over active items
     Activity  — pending AI-staged imports + the audit-event timeline       */

import { createApp, esc } from './ui.js?v=2';
import { pricingApi } from './api.js?v=2';
import { authReady } from './auth-gate.js?v=2';

const auth = await authReady;

const fmtc = n => (Number(n) || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtWhen = d => d ? new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
const STATUS = {
  fresh: { color: '#2E9E62', label: 'Fresh' },
  aging: { color: '#D98E04', label: 'Aging' },
  stale: { color: '#C9403B', label: 'Stale' },
  none: { color: '#B9BDCC', label: 'No pricing' },
};
const SOURCE_LABEL = { 'feed-csv': 'CSV feed', 'feed-xml': 'XML feed', excel: 'Spreadsheet', 'mcp-manual': 'MCP manual' };
const dot = st => `<span class="dot" style="background:${(STATUS[st] || STATUS.none).color}" title="${(STATUS[st] || STATUS.none).label}"></span>`;
const scopeChip = sc => sc ? `<span style="font-weight:600;font-size:11.5px;color:var(--accent-ink);background:var(--accent-soft,#EEEDF7);border-radius:99px;padding:2px 9px;margin-left:6px">${esc(sc)}</span>` : '';

const [suppliers, freshness] = await Promise.all([
  pricingApi.suppliers().catch(() => []),
  pricingApi.freshness().catch(() => []),
]);

const state = {
  view: 'suppliers',
  suppliers, freshness,
  /* suppliers list */
  supFilter: '', supSort: { key: 'name', dir: 1 }, supHideEmpty: false,
  /* supplier detail */
  detail: null, detailLoading: false, detailRevId: null, detailChanges: null,
  /* freshness */
  fsFilter: 'all', fsSearch: '', fsSort: { key: 'ratio', dir: -1 },
  /* catalogue */
  catSearch: '', catSupplier: 'all', catItems: [], catTotal: 0, catPage: 1, catLoading: false,
  /* activity */
  activity: null, activityLoading: false,
};

let seq = 0, timer = null;
async function fetchCatalogue(app) {
  const mySeq = ++seq;
  app.setState({ catLoading: true });
  try {
    const s = app.state;
    const r = await pricingApi.search({ search: s.catSearch.trim(), supplier_id: s.catSupplier, page: s.catPage, page_size: 50 });
    if (mySeq !== seq) return;
    app.setState({ catItems: r.items, catTotal: r.total, catLoading: false });
  } catch {
    if (mySeq === seq) app.setState({ catItems: [], catTotal: 0, catLoading: false });
  }
}

function sortRows(rows, { key, dir }) {
  return rows.slice().sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

async function refreshActivity(app) {
  app.setState({ activityLoading: true });
  try { app.setState({ activity: await pricingApi.activity(), activityLoading: false }); }
  catch { app.setState({ activityLoading: false }); }
}

const actions = {
  showView(e, d) {
    this.setState({ view: d.view, detail: null, detailRevId: null, detailChanges: null });
    if (d.view === 'catalogue' && !this.state.catItems.length && !this.state.catSearch) fetchCatalogue(this);
    if (d.view === 'activity') refreshActivity(this);
  },
  refreshActivity() { refreshActivity(this); },
  /* suppliers list */
  onSupFilter(e) { this.setState({ supFilter: e.target.value }); },
  toggleSupEmpty() { this.setState(s => ({ supHideEmpty: !s.supHideEmpty })); },
  sortSup(e, d) {
    this.setState(s => ({ supSort: { key: d.key, dir: s.supSort.key === d.key ? -s.supSort.dir : 1 } }));
  },
  async openSupplier(e, d) {
    this.setState({ detailLoading: true, detail: null, detailRevId: null, detailChanges: null });
    try { this.setState({ detail: await pricingApi.supplier(d.id), detailLoading: false }); }
    catch { this.setState({ detailLoading: false }); }
  },
  closeSupplier() { this.setState({ detail: null, detailRevId: null, detailChanges: null }); },
  async openRevision(e, d) {
    const id = parseInt(d.rev, 10);
    if (this.state.detailRevId === id) return this.setState({ detailRevId: null, detailChanges: null });
    this.setState({ detailRevId: id, detailChanges: null });
    try {
      const r = await pricingApi.changes(id, { page_size: 500 });
      if (this.state.detailRevId === id) this.setState({ detailChanges: r });
    } catch { /* leave null */ }
  },
  /* freshness */
  setFsFilter(e, d) { this.setState({ fsFilter: d.filter }); },
  onFsSearch(e) { this.setState({ fsSearch: e.target.value }); },
  sortFs(e, d) {
    this.setState(s => ({ fsSort: { key: d.key, dir: s.fsSort.key === d.key ? -s.fsSort.dir : 1 } }));
  },
  /* catalogue */
  onCatSearch(e) {
    this.setState({ catSearch: e.target.value, catPage: 1 });
    clearTimeout(timer);
    timer = setTimeout(() => fetchCatalogue(this), 250);
  },
  selectCatSupplier(e) { this.setState({ catSupplier: e.target.value, catPage: 1 }); fetchCatalogue(this); },
  catPrev() { this.setState(s => ({ catPage: Math.max(1, s.catPage - 1) })); fetchCatalogue(this); },
  catNext() { this.setState({ catPage: this.state.catPage + 1 }); fetchCatalogue(this); },
};

/* ---------- suppliers ---------- */

function th(label, key, sort, action, extra = '') {
  const arrow = sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '';
  return `<th data-click="${action}" data-key="${key}" style="cursor:pointer;user-select:none;font-weight:600;${extra}">${label}${arrow}</th>`;
}

function suppliersView(s) {
  if (s.detailLoading) return '<div style="color:var(--muted);padding:26px 4px">Loading supplier…</div>';
  if (s.detail) return supplierDetail(s);
  const q = s.supFilter.trim().toLowerCase();
  let rows = s.suppliers.filter(x =>
    (!q || (x.name + ' ' + x.code).toLowerCase().includes(q)) &&
    (!s.supHideEmpty || x.active_items > 0));
  const withRatio = rows.map(x => ({ ...x, ratio: x.days_old == null ? null : x.days_old / Math.max(x.stale_days, 1) }));
  rows = sortRows(withRatio, s.supSort);
  return `
  <div style="display:flex;gap:11px;margin:0 0 14px;flex-wrap:wrap;align-items:center">
    <div class="search" style="flex:1;min-width:280px">
      <span class="search-icon">⌕</span>
      <input class="input" data-focus="sup-filter" data-input="onSupFilter" value="${esc(s.supFilter)}" placeholder="Filter suppliers…" style="padding-left:34px;width:100%">
    </div>
    <label style="display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--muted);cursor:pointer">
      <input type="checkbox" data-change="toggleSupEmpty" ${s.supHideEmpty ? 'checked' : ''}> Hide suppliers without pricing
    </label>
    <span style="font-size:12.5px;color:var(--muted)">${rows.length} of ${s.suppliers.length}</span>
  </div>
  <div class="card" style="overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <thead><tr class="thead-caps" style="background:var(--surface-2);text-align:left">
        <th style="width:30px;padding:11px 8px 11px 18px"></th>
        ${th('Supplier', 'name', s.supSort, 'sortSup', 'padding:11px 8px')}
        ${th('Source', 'source_kind', s.supSort, 'sortSup', 'padding:11px 8px;width:130px')}
        ${th('Items', 'active_items', s.supSort, 'sortSup', 'padding:11px 8px;width:90px;text-align:right')}
        ${th('Revisions', 'revisions', s.supSort, 'sortSup', 'padding:11px 8px;width:100px;text-align:right')}
        ${th('Last import', 'last_import', s.supSort, 'sortSup', 'padding:11px 8px;width:130px')}
        ${th('Age', 'ratio', s.supSort, 'sortSup', 'padding:11px 18px 11px 8px;width:90px;text-align:right')}
      </tr></thead>
      <tbody>
        ${rows.map(x => `
        <tr class="pr-row" data-click="openSupplier" data-id="${x.id}" style="border-top:1px solid var(--line-2);cursor:pointer">
          <td style="padding:11px 8px 11px 18px">${dot(x.status)}</td>
          <td style="padding:11px 8px;font-weight:700">${esc(x.name)} <span style="color:var(--muted-2);font-weight:500;font-size:11.5px">${esc(x.code)}</span></td>
          <td style="padding:11px 8px;color:var(--muted)">${esc(SOURCE_LABEL[x.source_kind] || x.source_kind || '—')}</td>
          <td style="padding:11px 8px;text-align:right;font-variant-numeric:tabular-nums">${(x.active_items || 0).toLocaleString('en-AU')}</td>
          <td style="padding:11px 8px;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)">${x.revisions || 0}</td>
          <td style="padding:11px 8px;color:var(--muted)">${fmtDate(x.last_import)}</td>
          <td style="padding:11px 18px 11px 8px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:${(STATUS[x.status] || STATUS.none).color}">${x.days_old == null ? '—' : x.days_old + 'd'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${rows.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:36px">No suppliers match.</div>' : ''}
  </div>`;
}

function supplierDetail(s) {
  const d = s.detail;
  const sup = d.supplier;
  const KIND = { added: '#2E9E62', changed: '#D98E04', removed: '#C9403B' };
  return `
  <div style="display:flex;align-items:center;gap:12px;margin:0 0 14px">
    <button class="btn btn-secondary" data-click="closeSupplier" style="font-size:13px">← All suppliers</button>
    <div style="font-family:Roboto,system-ui,sans-serif;font-weight:900;font-size:18px;color:var(--navy)">${esc(sup.name)}</div>
    <span style="color:var(--muted-2);font-size:12px">${esc(sup.code)}</span>
    ${sup.is_active ? '' : '<span style="color:#C9403B;font-size:12px;font-weight:700">INACTIVE</span>'}
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-bottom:14px">
    <div class="card" style="padding:16px 18px">
      <div class="thead-caps" style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:10px">How this supplier updates</div>
      ${d.config.length ? d.config.map(c => `
        <div style="padding:8px 0;border-top:1px solid var(--line-2)">
          <div style="font-weight:700;font-size:13.5px">${esc(SOURCE_LABEL[c.source_kind] || c.source_kind || 'Not configured')}${scopeChip(c.scope_label)}
            <span style="float:right;color:var(--muted);font-weight:500;font-size:12.5px">expected every ${c.stale_days}d</span></div>
          ${c.source_url ? `<div style="font-size:11.5px;color:var(--muted);word-break:break-all;margin-top:4px">${esc(c.source_url)}</div>` : ''}
        </div>`).join('')
      : '<div style="color:var(--muted);font-size:13px">No source configured — updates arrive via MCP imports (spreadsheet or feed handed to the AI). Default staleness window 180d.</div>'}
      ${sup.contact_name || sup.contact_email || sup.contact_phone ? `
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line-2);font-size:12.5px;color:var(--muted)">
        ${esc([sup.contact_name, sup.contact_email, sup.contact_phone].filter(Boolean).join(' · '))}
      </div>` : ''}
      ${sup.notes ? `<div style="margin-top:8px;font-size:12.5px;color:var(--muted)">${esc(sup.notes)}</div>` : ''}
    </div>
    <div class="card" style="padding:16px 18px">
      <div class="thead-caps" style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:10px">Current pricing</div>
      ${d.freshness.length ? d.freshness.map(f => {
        const cfg = d.config.find(c => (c.scope_label || '') === (f.scope_label || ''));
        const stale = cfg ? cfg.stale_days : 180;
        const st = f.days_old >= stale ? 'stale' : f.days_old >= stale * 0.7 ? 'aging' : 'fresh';
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line-2)">
          ${dot(st)}
          <div style="flex:1"><b style="font-weight:700;font-size:13.5px">${esc(f.revision_label)}</b>${scopeChip(f.scope_label)}
            <div style="font-size:12px;color:var(--muted)">${fmtDate(f.imported_at)} · ${f.items.toLocaleString('en-AU')} items</div></div>
          <span style="font-weight:600;color:${STATUS[st].color};font-variant-numeric:tabular-nums">${f.days_old}d</span>
        </div>`;
      }).join('') : '<div style="color:var(--muted);font-size:13px">No active pricing yet.</div>'}
    </div>
  </div>

  <div class="thead-caps" style="font-size:11px;color:var(--muted);font-weight:700;margin:16px 0 8px">Revision history</div>
  ${d.revisions.map(r => {
    const sm = r.summary || {};
    const open = s.detailRevId === r.id;
    return `
    <div class="card" style="margin-bottom:8px;overflow:hidden">
      <div data-click="openRevision" data-rev="${r.id}" style="display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer">
        <span class="dot" style="background:${r.is_active ? '#2E9E62' : 'var(--line)'}" title="${r.is_active ? 'Active' : 'Archived'}"></span>
        <div style="flex:1">
          <b style="font-weight:700;font-size:13.5px">${esc(r.revision_label)}</b>${scopeChip(r.scope_label)}
          <div style="font-size:12px;color:var(--muted)">${fmtDate(r.imported_at)} · ${r.items.toLocaleString('en-AU')} items · ${esc(r.filename || '')}${r.is_active ? '' : ' · archived ' + fmtDate(r.archived_at)}</div>
        </div>
        <span style="font-size:12px;color:var(--muted)">${['added', 'changed', 'removed'].filter(k => sm[k]).map(k => `<b style="color:${KIND[k]}">${sm[k]} ${k}</b>`).join(' · ')}</span>
        <span style="color:var(--muted)">${open ? '▾' : '▸'}</span>
      </div>
      ${open ? `
      <div style="border-top:1px solid var(--line-2);max-height:400px;overflow-y:auto">
        ${!s.detailChanges ? '<div style="color:var(--muted);padding:16px">Loading changes…</div>' : `
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>
          ${s.detailChanges.changes.map(c => {
            const b = c.before || {}, a = c.after || {};
            const price = c.change_kind === 'changed' && b.cost_price != null && a.cost_price != null
              ? `${fmtc(b.cost_price)} → <b>${fmtc(a.cost_price)}</b>`
              : (a.cost_price != null ? fmtc(a.cost_price) : (b.cost_price != null ? fmtc(b.cost_price) : ''));
            return `<tr style="border-top:1px solid var(--line-2)">
              <td style="padding:7px 8px 7px 16px;width:90px"><span style="font-size:11px;font-weight:700;color:${KIND[c.change_kind]};text-transform:uppercase">${c.change_kind}</span></td>
              <td style="padding:7px 8px;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;width:180px">${esc(c.sku)}</td>
              <td style="padding:7px 8px;color:var(--muted)">${esc(c.description || '')}</td>
              <td style="padding:7px 16px 7px 8px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${price}</td>
            </tr>`;
          }).join('')}
        </tbody></table>
        ${s.detailChanges.total > s.detailChanges.changes.length ? `<div style="color:var(--muted);padding:10px 16px;font-size:12px">Showing ${s.detailChanges.changes.length} of ${s.detailChanges.total} changes.</div>` : ''}`}
      </div>` : ''}
    </div>`;
  }).join('') || '<div style="color:var(--muted);font-size:13px;padding:4px">No revisions yet.</div>'}

  ${d.events.length ? `
  <div class="thead-caps" style="font-size:11px;color:var(--muted);font-weight:700;margin:16px 0 8px">Recent activity</div>
  <div class="card" style="padding:4px 16px">
    ${d.events.map(ev => `
    <div style="display:flex;gap:10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line-2);font-size:13px">
      <span style="font-weight:700;text-transform:uppercase;font-size:11px;color:var(--accent-ink);width:70px;flex:none">${esc(ev.action)}</span>
      <span style="flex:1">${esc(ev.revision_label || '')}${ev.reason ? ` <span style="color:var(--muted)">— ${esc(ev.reason)}</span>` : ''}</span>
      <span style="color:var(--muted-2);font-size:12px;flex:none">${esc(ev.actor_name || 'system')} · ${fmtWhen(ev.created_at)}</span>
    </div>`).join('')}
  </div>` : ''}`;
}

/* ---------- freshness ---------- */

function freshnessView(s) {
  const counts = { fresh: 0, aging: 0, stale: 0 };
  s.freshness.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const q = s.fsSearch.trim().toLowerCase();
  let rows = s.freshness
    .filter(r => (s.fsFilter === 'all' || r.status === s.fsFilter) &&
                 (!q || (r.name + ' ' + (r.scope_label || '')).toLowerCase().includes(q)))
    .map(r => ({ ...r, ratio: r.days_old / Math.max(r.stale_days, 1) }));
  rows = sortRows(rows, s.fsSort);
  return `
  <div style="display:flex;gap:10px;margin:0 0 14px;flex-wrap:wrap;align-items:center">
    ${['all', 'stale', 'aging', 'fresh'].map(f => `
      <button class="btn ${s.fsFilter === f ? 'btn-primary' : 'btn-secondary'}" data-click="setFsFilter" data-filter="${f}" style="font-size:13px">
        ${f === 'all' ? `All · ${s.freshness.length}` : `${STATUS[f].label} · ${counts[f] || 0}`}
      </button>`).join('')}
    <div class="search" style="flex:1;min-width:240px">
      <span class="search-icon">⌕</span>
      <input class="input" data-focus="fs-search" data-input="onFsSearch" value="${esc(s.fsSearch)}" placeholder="Filter suppliers…" style="padding-left:34px;width:100%">
    </div>
  </div>
  <div class="card" style="overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <thead><tr class="thead-caps" style="background:var(--surface-2);text-align:left">
        <th style="width:30px;padding:11px 8px 11px 18px"></th>
        ${th('Supplier', 'name', s.fsSort, 'sortFs', 'padding:11px 8px')}
        ${th('Items', 'items', s.fsSort, 'sortFs', 'padding:11px 8px;width:90px;text-align:right')}
        ${th('Active revision', 'revision_label', s.fsSort, 'sortFs', 'padding:11px 8px')}
        ${th('Imported', 'imported_at', s.fsSort, 'sortFs', 'padding:11px 8px;width:130px')}
        ${th('Age', 'ratio', s.fsSort, 'sortFs', 'padding:11px 8px;width:90px;text-align:right')}
        ${th('Expected every', 'stale_days', s.fsSort, 'sortFs', 'padding:11px 18px 11px 8px;width:130px;text-align:right')}
      </tr></thead>
      <tbody>
        ${rows.map(r => `
        <tr class="pr-row" data-click="openSupplier" data-id="${r.supplier_id}" style="border-top:1px solid var(--line-2);cursor:pointer">
          <td style="padding:11px 8px 11px 18px">${dot(r.status)}</td>
          <td style="padding:11px 8px;font-weight:700">${esc(r.name)}${scopeChip(r.scope_label)}</td>
          <td style="padding:11px 8px;text-align:right;font-variant-numeric:tabular-nums">${r.items.toLocaleString('en-AU')}</td>
          <td style="padding:11px 8px;color:var(--muted)">${esc(r.revision_label)}</td>
          <td style="padding:11px 8px;color:var(--muted)">${fmtDate(r.imported_at)}</td>
          <td style="padding:11px 8px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:${STATUS[r.status].color}">${r.days_old}d</td>
          <td style="padding:11px 18px 11px 8px;text-align:right;color:var(--muted)">${r.stale_days}d</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${rows.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:36px">Nothing matches.</div>' : ''}
  </div>
  <div style="font-size:12px;color:var(--muted-2);margin-top:8px">Click a row to open the supplier. Click a column header to sort.</div>`;
}

/* ---------- catalogue ---------- */

function catalogueView(s) {
  const from = s.catItems.length ? (s.catPage - 1) * 50 + 1 : 0;
  const to = (s.catPage - 1) * 50 + s.catItems.length;
  return `
  <div style="display:flex;gap:11px;margin:0 0 14px;flex-wrap:wrap">
    <div class="search" style="flex:2;min-width:300px">
      <span class="search-icon">⌕</span>
      <input class="input" data-focus="cat-search" data-input="onCatSearch" value="${esc(s.catSearch)}" placeholder="Search brand, SKU, model, description…" style="padding-left:34px;width:100%">
    </div>
    <select class="input" data-change="selectCatSupplier" data-value="${esc(s.catSupplier)}" style="flex:1;min-width:220px">
      <option value="all">All suppliers</option>
      ${s.suppliers.filter(x => x.active_items > 0).map(x => `<option value="${x.id}">${esc(x.name)} (${(x.active_items || 0).toLocaleString('en-AU')})</option>`).join('')}
    </select>
  </div>
  <div class="card" style="overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <thead><tr class="thead-caps" style="background:var(--surface-2)">
        <th style="text-align:left;font-weight:600;padding:11px 8px 11px 18px;width:110px">Brand</th>
        <th style="text-align:left;font-weight:600;padding:11px 8px;width:170px">Model</th>
        <th style="text-align:left;font-weight:600;padding:11px 8px">Description</th>
        <th style="text-align:left;font-weight:600;padding:11px 8px;width:170px">Category</th>
        <th style="text-align:right;font-weight:600;padding:11px 18px 11px 8px;width:110px">Cost</th>
      </tr></thead>
      <tbody>
        ${s.catItems.map(p => {
          const model = (p.short_description && p.short_description !== p.description) ? p.short_description : (p.sku || '—');
          return `
          <tr class="pr-row" style="border-top:1px solid var(--line-2)">
            <td style="padding:11px 8px 11px 18px;color:var(--muted);font-weight:600;text-transform:uppercase;font-size:12px;white-space:nowrap">${esc(p.brand || '—')}</td>
            <td style="padding:11px 8px;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap">${esc(model)}</td>
            <td style="padding:11px 8px"><b style="font-weight:600">${esc(p.description)}</b><div style="color:var(--muted);font-size:12px">${esc(p.supplier_name || '')} · ${esc(p.revision_label || '')}${p.sku && p.sku !== model ? ' · SKU ' + esc(p.sku) : ''}</div></td>
            <td style="padding:11px 8px;color:var(--muted)">${esc(p.category || '')}</td>
            <td style="padding:11px 18px 11px 8px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${fmtc(p.cost_price)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${s.catItems.length === 0 ? `<div style="text-align:center;color:var(--muted);padding:36px">${s.catLoading ? 'Searching…' : 'No matches.'}</div>` : ''}
    <div style="display:flex;align-items:center;gap:10px;padding:11px 18px;border-top:1px solid var(--line-2);background:var(--surface-2);font-size:12.5px;color:var(--muted)">
      ${s.catTotal.toLocaleString('en-AU')} items
      ${s.catTotal > 50 ? `
      <span style="margin-left:auto;display:inline-flex;align-items:center;gap:9px">
        <button class="btn btn-secondary" data-click="catPrev" ${s.catPage <= 1 ? 'disabled style="opacity:.45"' : ''}>‹ Prev</button>
        ${from}–${to}
        <button class="btn btn-secondary" data-click="catNext" ${to >= s.catTotal ? 'disabled style="opacity:.45"' : ''}>Next ›</button>
      </span>` : ''}
    </div>
  </div>`;
}

/* ---------- activity ---------- */

function activityView(s) {
  if (s.activityLoading && !s.activity) return '<div style="color:var(--muted);padding:26px 4px">Loading…</div>';
  const a = s.activity || { pending: [], events: [] };
  return `
  <div style="display:flex;align-items:center;gap:10px;margin:0 0 14px">
    <div style="font-size:13px;color:var(--muted)">Everything the AI stages or commits shows up here — this app never writes.</div>
    <button class="btn btn-secondary" data-click="refreshActivity" style="margin-left:auto;font-size:13px">↻ Refresh</button>
  </div>
  ${a.pending.length ? `
  <div class="thead-caps" style="font-size:11px;color:var(--muted);font-weight:700;margin:0 0 8px">Staged imports awaiting commit</div>
  ${a.pending.map(p => `
  <div class="card" style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:8px;border-left:3px solid #D98E04">
    <div style="flex:1">
      <b style="font-weight:700">${esc(p.supplier_name || 'Unknown supplier')}</b>${scopeChip(p.scope_label)}
      <div style="font-size:12px;color:var(--muted)">${esc(p.revision_label || p.filename)} · ${p.staged_count.toLocaleString('en-AU')} rows staged · ${fmtWhen(p.uploaded_at)}</div>
    </div>
    <span style="font-size:11.5px;font-weight:700;color:#D98E04;text-transform:uppercase">pending</span>
  </div>`).join('')}` : ''}
  <div class="thead-caps" style="font-size:11px;color:var(--muted);font-weight:700;margin:14px 0 8px">Timeline</div>
  <div class="card" style="padding:4px 16px">
    ${a.events.length ? a.events.map(ev => `
    <div style="display:flex;gap:10px;align-items:baseline;padding:9px 0;border-top:1px solid var(--line-2);font-size:13px">
      <span style="font-weight:700;text-transform:uppercase;font-size:11px;color:var(--accent-ink);width:70px;flex:none">${esc(ev.action)}</span>
      <span style="flex:1"><b style="font-weight:700">${esc(ev.supplier_name || '')}</b>${scopeChip(ev.scope_label)} ${esc(ev.revision_label || '')}${ev.reason ? ` <span style="color:var(--muted)">— ${esc(ev.reason)}</span>` : ''}</span>
      <span style="color:var(--muted-2);font-size:12px;flex:none">${esc(ev.actor_name || 'system')} · ${fmtWhen(ev.created_at)}</span>
    </div>`).join('') : '<div style="color:var(--muted);padding:16px 0;font-size:13px">No activity recorded yet.</div>'}
  </div>`;
}

function render(s) {
  const tabs = [['suppliers', 'Suppliers'], ['freshness', 'Freshness'], ['catalogue', 'Catalogue'], ['activity', 'Activity']];
  return `
  <div style="max-width:1400px;margin:0 auto;padding:18px 22px 40px">
    <header style="display:flex;align-items:center;gap:14px;padding:6px 0 18px">
      <a href="/dashboard" class="btn btn-secondary" style="font-size:13px">← Dashboard</a>
      <img src="assets/sks-logo-navy.png" alt="SKS" style="height:30px" onerror="this.style.display='none'">
      <div>
        <div style="font-family:Roboto,system-ui,sans-serif;font-weight:900;font-size:19px;color:var(--navy)">Pricing Database</div>
        <div style="font-size:12px;color:var(--muted)">Supplier pricing — read-only window; the AI drives updates</div>
      </div>
      <span style="margin-left:auto;font-size:13px;color:var(--muted)">${esc(auth.name)}</span>
    </header>
    <nav style="display:flex;gap:8px;margin:0 0 18px">
      ${tabs.map(([k, label]) => `
        <button class="btn ${s.view === k && !s.detail ? 'btn-primary' : 'btn-secondary'}" data-click="showView" data-view="${k}" style="font-size:13.5px;padding:9px 18px">${label}</button>`).join('')}
    </nav>
    ${s.view === 'suppliers' ? suppliersView(s)
      : s.view === 'freshness' ? (s.detail || s.detailLoading ? suppliersView(s) : freshnessView(s))
      : s.view === 'catalogue' ? catalogueView(s)
      : activityView(s)}
  </div>`;
}

createApp({ root: document.getElementById('app'), state, actions, render });
