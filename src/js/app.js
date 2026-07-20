/* SKS Pricing Database — read-only v1 (PRICING-DB-PLAN.md P4).
   Own app grant (`pricing`, via data-app-grant on <html>); reads the live
   pricing store through /api/pricing. Three views:
     Freshness — traffic-light board per supplier×scope (replaces the Master
                 BoM's manual "Update Schedule" tab)
     Catalogue — server-side search over active items
     History   — revision timeline per supplier + per-SKU change log        */

import { createApp, esc } from './ui.js?v=1';
import { pricingApi } from './api.js?v=1';
import { authReady } from './auth-gate.js?v=1';

const auth = await authReady;

const fmtc = n => (Number(n) || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const STATUS = {
  fresh: { color: '#2E9E62', label: 'Fresh' },
  aging: { color: '#D98E04', label: 'Aging' },
  stale: { color: '#C9403B', label: 'Stale' },
};

const [freshness, suppliers] = await Promise.all([
  pricingApi.freshness().catch(() => []),
  pricingApi.suppliers().catch(() => []),
]);

const state = {
  view: 'freshness',
  freshness,
  suppliers,
  fsFilter: 'all',
  /* catalogue */
  catSearch: '', catSupplier: 'all', catItems: [], catTotal: 0, catPage: 1, catLoading: false,
  /* history */
  histSupplier: '', histRevisions: [], histRevId: null, histChanges: null, histLoading: false,
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

const actions = {
  showView(e, d) {
    this.setState({ view: d.view });
    if (d.view === 'catalogue' && !this.state.catItems.length && !this.state.catSearch) fetchCatalogue(this);
  },
  setFsFilter(e, d) { this.setState({ fsFilter: d.filter }); },
  onCatSearch(e) {
    this.setState({ catSearch: e.target.value, catPage: 1 });
    clearTimeout(timer);
    timer = setTimeout(() => fetchCatalogue(this), 250);
  },
  selectCatSupplier(e) { this.setState({ catSupplier: e.target.value, catPage: 1 }); fetchCatalogue(this); },
  catPrev() { this.setState(s => ({ catPage: Math.max(1, s.catPage - 1) })); fetchCatalogue(this); },
  catNext() { this.setState({ catPage: this.state.catPage + 1 }); fetchCatalogue(this); },
  async selectHistSupplier(e) {
    const id = e.target.value;
    this.setState({ histSupplier: id, histRevisions: [], histRevId: null, histChanges: null, histLoading: !!id });
    if (!id) return;
    try {
      const revisions = await pricingApi.revisions(id);
      if (this.state.histSupplier === id) this.setState({ histRevisions: revisions, histLoading: false });
    } catch { this.setState({ histLoading: false }); }
  },
  async openRevision(e, d) {
    const id = parseInt(d.rev, 10);
    this.setState({ histRevId: id, histChanges: null });
    try {
      const r = await pricingApi.changes(id, { page_size: 500 });
      if (this.state.histRevId === id) this.setState({ histChanges: r });
    } catch { /* leave null */ }
  },
  closeRevision() { this.setState({ histRevId: null, histChanges: null }); },
};

/* ---------- views ---------- */

function freshnessView(s) {
  const counts = { fresh: 0, aging: 0, stale: 0 };
  s.freshness.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const rows = s.freshness.filter(r => s.fsFilter === 'all' || r.status === s.fsFilter);
  return `
  <div style="display:flex;gap:10px;margin:0 0 16px">
    ${['all', 'stale', 'aging', 'fresh'].map(f => `
      <button class="btn ${s.fsFilter === f ? 'btn-primary' : 'btn-secondary'}" data-click="setFsFilter" data-filter="${f}" style="font-size:13px">
        ${f === 'all' ? `All · ${s.freshness.length}` : `${STATUS[f].label} · ${counts[f] || 0}`}
      </button>`).join('')}
  </div>
  <div class="card" style="overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <thead><tr class="thead-caps" style="background:var(--surface-2)">
        <th style="text-align:left;font-weight:600;padding:11px 8px 11px 18px;width:30px"></th>
        <th style="text-align:left;font-weight:600;padding:11px 8px">Supplier</th>
        <th style="text-align:right;font-weight:600;padding:11px 8px;width:90px">Items</th>
        <th style="text-align:left;font-weight:600;padding:11px 8px">Active revision</th>
        <th style="text-align:left;font-weight:600;padding:11px 8px;width:130px">Imported</th>
        <th style="text-align:right;font-weight:600;padding:11px 8px;width:100px">Age</th>
        <th style="text-align:right;font-weight:600;padding:11px 18px 11px 8px;width:130px">Expected every</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
        <tr class="pr-row" style="border-top:1px solid var(--line-2)">
          <td style="padding:11px 8px 11px 18px"><span class="dot" style="background:${STATUS[r.status].color}" title="${STATUS[r.status].label}"></span></td>
          <td style="padding:11px 8px;font-weight:700">${esc(r.name)}${r.scope_label ? ` <span style="font-weight:600;font-size:11.5px;color:var(--accent-ink);background:var(--accent-soft,#EEEDF7);border-radius:99px;padding:2px 9px;margin-left:6px">${esc(r.scope_label)}</span>` : ''}</td>
          <td style="padding:11px 8px;text-align:right;font-variant-numeric:tabular-nums">${r.items.toLocaleString('en-AU')}</td>
          <td style="padding:11px 8px;color:var(--muted)">${esc(r.revision_label)}</td>
          <td style="padding:11px 8px;color:var(--muted)">${fmtDate(r.imported_at)}</td>
          <td style="padding:11px 8px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:${STATUS[r.status].color}">${r.days_old}d</td>
          <td style="padding:11px 18px 11px 8px;text-align:right;color:var(--muted)">${r.stale_days}d</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${rows.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:36px">Nothing in this bucket.</div>' : ''}
  </div>`;
}

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
      ${s.suppliers.filter(x => x.active_items > 0).map(x => `<option value="${x.id}">${esc(x.name)} (${x.active_items.toLocaleString('en-AU')})</option>`).join('')}
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

function historyView(s) {
  const KIND = { added: '#2E9E62', changed: '#D98E04', removed: '#C9403B' };
  return `
  <div style="margin:0 0 14px;max-width:420px">
    <select class="input" data-change="selectHistSupplier" data-value="${esc(String(s.histSupplier))}" style="width:100%">
      <option value="">Choose a supplier…</option>
      ${s.suppliers.filter(x => x.revisions > 0).map(x => `<option value="${x.id}">${esc(x.name)} (${x.revisions} revision${x.revisions === 1 ? '' : 's'})</option>`).join('')}
    </select>
  </div>
  ${s.histLoading ? '<div style="color:var(--muted);padding:20px 4px">Loading…</div>' : ''}
  ${s.histRevisions.map(r => {
    const sm = r.summary || {};
    const open = s.histRevId === r.id;
    return `
    <div class="card" style="margin-bottom:10px;overflow:hidden">
      <div data-click="${open ? 'closeRevision' : 'openRevision'}" data-rev="${r.id}" style="display:flex;align-items:center;gap:12px;padding:13px 18px;cursor:pointer">
        <span class="dot" style="background:${r.is_active ? '#2E9E62' : 'var(--line)'}" title="${r.is_active ? 'Active' : 'Archived'}"></span>
        <div style="flex:1">
          <b style="font-weight:700">${esc(r.revision_label)}</b>
          ${r.scope_label ? `<span style="font-size:11.5px;color:var(--accent-ink);background:var(--accent-soft,#EEEDF7);border-radius:99px;padding:2px 9px;margin-left:6px">${esc(r.scope_label)}</span>` : ''}
          <div style="font-size:12px;color:var(--muted)">${fmtDate(r.imported_at)} · ${r.items.toLocaleString('en-AU')} items · ${esc(r.filename || '')}${r.is_active ? '' : ' · archived ' + fmtDate(r.archived_at)}</div>
        </div>
        <span style="font-size:12px;color:var(--muted)">
          ${['added', 'changed', 'removed'].filter(k => sm[k]).map(k => `<b style="color:${KIND[k]}">${sm[k]} ${k}</b>`).join(' · ') || ''}
        </span>
        <span style="color:var(--muted)">${open ? '▾' : '▸'}</span>
      </div>
      ${open ? `
      <div style="border-top:1px solid var(--line-2);max-height:420px;overflow-y:auto">
        ${!s.histChanges ? '<div style="color:var(--muted);padding:18px">Loading changes…</div>' : `
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tbody>
            ${s.histChanges.changes.map(c => {
              const b = c.before || {}, a = c.after || {};
              const price = c.change_kind === 'changed' && b.cost_price != null && a.cost_price != null
                ? `${fmtc(b.cost_price)} → <b>${fmtc(a.cost_price)}</b>`
                : (a.cost_price != null ? fmtc(a.cost_price) : (b.cost_price != null ? fmtc(b.cost_price) : ''));
              return `
              <tr style="border-top:1px solid var(--line-2)">
                <td style="padding:8px 8px 8px 18px;width:90px"><span style="font-size:11px;font-weight:700;color:${KIND[c.change_kind]};text-transform:uppercase">${c.change_kind}</span></td>
                <td style="padding:8px;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;width:180px">${esc(c.sku)}</td>
                <td style="padding:8px;color:var(--muted)">${esc(c.description || '')}</td>
                <td style="padding:8px 18px 8px 8px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${price}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${s.histChanges.total > s.histChanges.changes.length ? `<div style="color:var(--muted);padding:12px 18px;font-size:12px">Showing ${s.histChanges.changes.length} of ${s.histChanges.total} changes.</div>` : ''}`}
      </div>` : ''}
    </div>`;
  }).join('')}
  ${!s.histLoading && s.histSupplier && !s.histRevisions.length ? '<div style="color:var(--muted);padding:20px 4px">No revisions for this supplier.</div>' : ''}`;
}

function render(s) {
  const tabs = [['freshness', 'Freshness'], ['catalogue', 'Catalogue'], ['history', 'History']];
  return `
  <div style="max-width:1400px;margin:0 auto;padding:18px 22px 40px">
    <header style="display:flex;align-items:center;gap:14px;padding:6px 0 18px">
      <a href="/dashboard" class="btn btn-secondary" style="font-size:13px">← Dashboard</a>
      <img src="assets/sks-logo-navy.png" alt="SKS" style="height:30px" onerror="this.style.display='none'">
      <div>
        <div style="font-family:Roboto,system-ui,sans-serif;font-weight:900;font-size:19px;color:var(--navy)">Pricing Database</div>
        <div style="font-size:12px;color:var(--muted)">Supplier pricelists, freshness &amp; history — read-only</div>
      </div>
      <span style="margin-left:auto;font-size:13px;color:var(--muted)">${esc(auth.name)}</span>
    </header>
    <nav style="display:flex;gap:8px;margin:0 0 18px">
      ${tabs.map(([k, label]) => `
        <button class="btn ${s.view === k ? 'btn-primary' : 'btn-secondary'}" data-click="showView" data-view="${k}" style="font-size:13.5px;padding:9px 18px">${label}</button>`).join('')}
    </nav>
    ${s.view === 'freshness' ? freshnessView(s) : s.view === 'catalogue' ? catalogueView(s) : historyView(s)}
  </div>`;
}

createApp({ root: document.getElementById('app'), state, actions, render });
