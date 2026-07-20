# Supplier Pricing Database — Plan

*Drafted 20 Jul 2026 from Mark's voice memo (Recording 66), the Master BoM workbook,
and a survey of the existing field-api pricelist engine. Companion to `PLAN.md`
(Phases 0–9 done); this covers the next tranche of work.*

## 1. The problem (from the recording + the BoM)

- Supplier pricing today lives in **Master BoM.xlsx**: ~11,150 product rows across
  28 category tabs (`Brand | Vendor | Model | Description | Cost (ex) | Updated | ETA/Notes`),
  plus Contacts (312), Deal Reg, Labour Rates per FY/state, and an **Update Schedule**
  tab manually tracking refresh frequency for 84 suppliers.
- It "works okay but won't keep working": **~49% of rows have pricing older than
  12 months**, 431 rows have no date, the Updated column mixes formats, and the
  Vendor column is overloaded — 374 distinct strings encoding deal-reg tiers
  ("Biamp 5%" / "Biamp 0%"), multi-vendor sourcing ("Dicker / Ingram / Synnex"),
  and duplicate spellings ("Amber" / "Amber Tech").
- Suppliers are heterogeneous: some issue Excel pricelists, some have APIs/portals.
  New pricing must **supersede** old pricing in a controlled, visible way.
- Mark's direction: **AI runs the ingestion**, humans stay accountable — a separate
  **pricing database app on the main dashboard** with its own user permissions, so
  one person can be made custodian of keeping it current.

## 2. What already exists — don't rebuild it

The V1 quoting app left behind a complete, tested, **live** pricelist engine in
field-api (branch `quotes-v2`, Postgres schema `quotes`). It is the backend of the
`pricelist_*` MCP tools today:

| Piece | Where | Notes |
|---|---|---|
| Supplier registry | `quotes.suppliers` | never auto-created on import |
| Catalogue rows | `quotes.supplier_pricelist_items` | brand, category, cost/list, uom, labour hrs, `raw` JSONB; active iff revision active |
| Revisions | `quotes.pricelist_revisions` | **one active revision per (supplier, scope)** enforced by partial unique index; `scope_label` handles tiers (Madison/Sennheiser today — fits deal-reg tiers) |
| Per-SKU audit | `quotes.pricelist_item_changes` | added/changed/removed with before/after JSONB |
| Import staging | `quotes.pricelist_file_scans` | `source_kind='rows'` + `staged_rows` JSONB (MCP rows-first) |
| Guardrails | `field-api/src/pricelist-guardrails.js` | frozen 12-category taxonomy, price-anomaly threshold, labour rules |
| Flow | `field-api/src/quotes.js` | import-rows → supersedence preview (`preview_hash`, low-overlap 409 / anomaly 422 blocks) → commit (transactional archive+activate) → rollback; audit events |
| Search/match | `GET /supplier-pricelist`, `POST /pricelist/match` | pg_trgm + unaccent, powers `build_quote_from_bom` |
| Auth | `requireQuotesAdmin` + OAuth scope `mcp.pricelist` | all writes admin-gated |

File-based ingestion (uploads, watched folders, NUC parsers) was **retired Jul 2026**
(routes return 410) — the AI rows-first path is the only import path, which is
exactly the "AI in charge" model.

**Core decision (recommended): adopt the existing `quotes` pricelist schema as the
single supplier-pricing store.** V2's flat `quotes_v2.catalogue` /
`catalogue_suppliers` tables (empty, never populated) get bypassed: the V2 builder
picker reads the pricelist search endpoints instead. Rebuilding this engine under
`quotes_v2` would be weeks of work for no functional gain.

## 3. Target architecture

```
 Sources                     Ingestion (AI)                Store                    Consumers
 ─────────                   ──────────────                ─────                    ─────────
 Excel pricelists ──┐        Claude reads source,          quotes.suppliers         V2 builder picker
 Supplier APIs ─────┼──────▶ normalises rows, calls ─────▶ pricelist_revisions ──▶  (search + match)
 Portal exports ────┘        pricelist_import_rows         supplier_pricelist_items MCP quote authoring
 (email/PDF later)           → preview → human/auto        item_changes (audit)     Pricing DB app
                             confirm → commit                                       (browse/history)
```

One pipeline regardless of source format. Excel and API differ only in how rows are
*obtained*; staging, guardrails, supersedence, and audit are identical.

## 4. The Pricing Database app (Mark's "separate app on the dashboard")

New tile on the Field Apps dashboard with **its own app grant** (e.g. `pricing`),
so a custodian can be appointed without being a Quotes admin. UI in this repo's
style (purple accents, same shell), pages roughly:

1. **Freshness board** (the landing page — replaces the Update Schedule tab).
   One card/row per supplier×scope: active revision label, imported date, expected
   refresh frequency, traffic-light staleness (green/amber/red). This is the
   single biggest win over the spreadsheet: staleness becomes visible instead of
   remembered. Backed by `pricelist_revisions.imported_at` + per-supplier
   frequency (repurpose `pricelist_scan_config.stale_days`, already in schema).
2. **Supplier registry** — names, aliases, scopes/tiers, contacts (migrated from
   the Contacts tab), deal-reg notes, source type (excel / api / portal), expected
   frequency.
3. **Catalogue browser** — search the live items (existing search endpoint),
   filter by supplier/category, see cost + revision provenance per row.
4. **Import review** — pending staged imports, supersedence diff (added / changed
   with old→new price / removed), confirm or abandon. UI over the existing
   preview/commit/abandon endpoints.
5. **History** — revision timeline per supplier, per-SKU change log, guarded
   rollback.

Permissions: `pricing.read` (view), `pricing.import` (stage + confirm),
`pricing.admin` (rollback, supplier registry edits). Backend change needed: today
writes require Quotes-admin; add the app grant and map these capabilities.

## 5. Ingestion playbook by source type

- **Excel pricelist arrives** (email/OneDrive): custodian drops it to Claude
  (or a scheduled agent watches a folder). Claude reads the sheet in-context,
  normalises to the row contract (sku, description, brand, category, cost, uom),
  calls `pricelist_import_rows` for that supplier, reviews the supersedence
  preview, and either auto-commits (clean preview) or leaves it pending for the
  custodian in the app (low overlap / price anomalies).
- **Supplier API/portal**: per-supplier connector scripts run on a schedule
  (cron'd agent), fetch current pricing, post through the *same* import-rows
  pipeline. Guardrails still apply — an API returning garbage gets blocked the
  same as a bad spreadsheet.
- **Staleness nag**: a scheduled job checks the freshness board weekly; red
  suppliers generate a task/notification to the custodian ("Madison pricing is
  94 days old, expected quarterly").
- Rules of the road: one supplier×scope per import call; dedupe SKUs before
  staging (the API rejects dupes); anomalies and low-overlap always stop for a
  human unless explicitly confirmed.

## 6. Seed migration — Master BoM → database

The one-off that makes the system real. Sequencing matters: **supplier
normalisation must come first**, because imports are per-supplier and unknown
suppliers are rejected (by design).

1. **Vendor audit**: reduce the 374 vendor strings to a canonical supplier list
   with aliases. Deal-reg tiers become scopes (`Biamp` + scope `deal-reg-5%`).
   Multi-vendor strings ("Dicker / Ingram / Synnex") → pick the primary vendor
   for the row; record alternates in `raw`/notes (see §8 for the longer-term
   sourcing model). Mark reviews and signs off the mapping table before import.
2. **Category mapping**: 28 BoM tabs → the frozen 12-category taxonomy in
   `pricelist-guardrails.js` (imports rejecting >50% Uncategorised makes this
   mandatory). Decide whether the taxonomy grows (e.g. does VC deserve its own
   category?) — one deliberate decision, not per-import drift.
3. **Import per supplier**: group all BoM rows by canonical supplier, run each
   through import-rows with `effective_date` from the Updated column and
   `source_label = "Master BoM seed"`. Rows with no/unparseable date get flagged,
   not silently dated today.
4. **Verification**: row counts per supplier vs BoM, spot-check prices, then wire
   check — search from the V2 builder returns seeded items.
5. **Out of scope here**: Labour Rates tabs (already modelled in V2
   settings/reference rates), ETA/stock notes (transient), TEMP project tabs.
   Contacts + Update Schedule migrate in §4's supplier registry, not as items.

## 7. Phased delivery

Follows the house convention: one phase at a time, verified in the browser before
sign-off.

- **P1 — Wire the builder to the engine.** V2 picker (`product-picker` equivalent)
  reads `/supplier-pricelist` search; manual-line fallback stays. Verifiable with
  whatever test data is in staging. *(Small; unblocks everything visually.)*
- **P2 — Supplier registry + BoM mapping sign-off.** Canonical suppliers, aliases,
  scopes, category mapping table. Deliverable is reviewable data, not UI.
- **P3 — Seed import.** AI-run per-supplier imports of the Master BoM through the
  guardrail pipeline. Success = builder searches return real SKS pricing.
- **P4 — Pricing Database app v1.** Dashboard tile + grant, freshness board,
  catalogue browser, revision history. Read-heavy first release.
- **P5 — Import review UI + custodian permissions.** Pending imports, diff review,
  confirm/abandon/rollback in the app; `pricing.*` capability split lands in
  field-api.
- **P6 — Automation.** Staleness cron + notifications; first supplier API
  connector (pick the easiest real one); scheduled refresh agents.

## 8. Down-the-line list (things that could pop up)

Flagged now so they don't surprise us; none block P1–P4.

- **Multi-vendor sourcing**: same product from Dicker *and* Ingram at different
  costs. Current model keys items by (supplier, sku) — fine short-term. If price
  competition between distributors matters, add a product-identity layer
  (brand+model) with per-vendor offers. Don't build until a real quote needs it.
- **Quote repricing**: quote lines pin `revision_id`, so old quotes keep their
  priced-at cost (correct). Eventually: a "pricing has moved since this quote"
  indicator + one-click reprice in the builder.
- **Price breaks / qty tiers, project-special pricing (deal reg per-project)**:
  scope_label can carry some of this; a proper deal-reg entity may be wanted later
  (the BoM has a Deal Reg tab with live registrations).
- **Currency**: all AUD today; if a supplier quotes USD, decide convert-at-import
  vs store-native. Convert-at-import with the rate recorded in `raw` is simplest.
- **Discontinued/EOL**: 'removed' change-kind covers disappearance from a
  pricelist; an explicit EOL flag with replacement-SKU pointer is a nice-to-have.
- **Datasheet/website links**: BoM carries them; keep in `raw` at seed time so
  nothing is lost, surface in the app later.
- **Schema/DDL ownership**: pricelist DDL currently lives in the *old* repo
  (`sks-quotes/server/migrations/`) and is applied by hand; migration 025's
  columns are load-bearing for the MCP path. Move canonical DDL somewhere owned
  (field-api or this repo's `server/migrations/`) before P5.
  *(Partially addressed 20 Jul 2026: the quotes-v2 **code** is now properly in
  git — staging branch fast-forwarded, module commits cherry-picked onto
  master, NUC staging checkout reconciled clean. NUC prod checkout is still
  dirty/behind — separate task spawned. DDL ownership remains open.)*
- **Postgres extensions**: search/match need `pg_trgm` + `unaccent` — verify on
  prod before P1 (they back the current staging behaviour, so likely fine).
- **Manual overrides**: `applyPricelistManualOverrides` lets admin edits survive
  re-imports — powerful and subtle; the app should *show* active overrides so
  they don't become invisible drift.
- **V2 catalogue tables**: once the picker reads the pricelist store, drop or
  view-ify `quotes_v2.catalogue` / `catalogue_suppliers` so there aren't two
  sources of truth.

## 9. Open decisions for Mark

1. **Reuse `quotes` schema as the pricing store** (recommended, §2) vs porting the
   engine into `quotes_v2`.
2. **Taxonomy**: keep the frozen 12 categories and map 28 BoM tabs onto them, or
   revise the taxonomy once, now, as part of P2.
3. **App identity**: separate dashboard app + grant `pricing` (recommended — it's
   what the recording asks for) vs an admin section inside the quotes app.
4. **Custodian**: who is the person made responsible once the app exists? Shapes
   how much of P5's permission work is needed on day one.
5. **Auto-commit policy**: may the AI auto-commit clean imports (no anomalies,
   healthy overlap), or does every commit need a human click? Recommended:
   auto-commit clean, queue anything blocked.

---

# Phase records (P1–P4 executed while this lived in SKS-Quotes-V2)

P1 record (20 Jul 2026) — picker wired to the live pricelist store:
- field-api `quotes-v2` branch: `GET /pricelist/meta` + `GET /pricelist/search`
  (token-AND unaccented search, contiguous-match ranking, paginated) reading
  `quotes.supplier_pricelist_items` — the same store the `pricelist_*` MCP flow
  maintains. `quotes_v2.catalogue` bypassed. Route tests green (16).
- Frontend: picker is server-side search (debounced, stale-response guard,
  Prev/Next paging); lines added from the picker carry real `cost`/`sku`/
  `brand`/`supplier` (+`plId`); calc prefers real cost over the sell×0.75
  prototype fallback; sell derives from cost via margin. Cables picker defaults
  to the Cabling & Connectivity category and seeds sell from cost + cables margin.
- Local mock now lives at `dev/mock-api-server.js` (launch config
  `quotes-v2-mock`, port 4174) incl. the pricelist contract; browser-verified:
  search/rank, add, real cost on the line, autosave → reload hydration, zero
  console errors.
- Deployed 20 Jul 2026 staging + prod (file-copy + `docker compose up -d
  --build`, cache-busters v=2→v=3). The live store already holds V1-imported
  pricing (31 suppliers; e.g. 88 items match "crestron touch", incl. labour
  components) — the picker shows real data on prod immediately. P2/P3 (supplier
  normalisation + Master BoM seed) fill the gaps vs the Master BoM.

P2 record (20 Jul 2026) — supplier registry + BoM mapping, awaiting Mark's sign-off:
- `dev/build-bom-maps.py` (re-runnable) reads the Master BoM and emits
  `data/pricing/bom-vendor-map.json` (374 vendor strings → 172 canonical
  suppliers with aliases, Biamp deal-reg scopes, primary-vendor overrides,
  skip list) + `bom-category-map.json` (28 tabs → frozen 12 taxonomy) +
  `supplier-registry.json`.
- Live-store reconciliation (prod psql): ~56k active items across 26 suppliers
  already imported May–Jun 2026 — all larger + fresher than their BoM tabs, so
  NOT re-seeded. P3 seed targets the 151 gap suppliers (5,622 rows; top:
  Dicker Data 700, Quantum Sphere 442, Extron 374, Ingram Micro 300).
- Suppliers match the store by CODE; prod display names drift from staging
  (cosmetic, noted for later).
- Review doc: `data/pricing/SUPPLIER-REGISTRY.md` (§1 decisions + sign-off
  block). **P3 does not run until Mark signs off.**

P3 record (20 Jul 2026) — Master BoM seed imported, staging + prod:
- Mark approved P2 as proposed (chat). `dev/build-seed-sql.py` generated
  idempotent, code-keyed SQL (`data/pricing/seed.sql`): first-import batches
  only, so no supersedence; guardrails (numeric price, per-supplier SKU dedupe
  first-wins, canonical categories) enforced in the generator. 5,380 rows /
  142 batches / 141 suppliers; excluded: 5,446 rows of live-covered suppliers,
  125 dup SKUs, 17 unpriced, 47 skip-list.
- Staging applied first (dry-run with ROLLBACK, then real): 139 revisions /
  5,081 items — Australis (3,443-item live list) and Westan (1,462) exist on
  staging only and were correctly guard-skipped. Verified via MCP search
  (68 Extron DTP items, correct costs/categories).
- Prod: needed `quotes.pricelist_audit_events` created first (migration 031
  DDL — prod predates it; prod also still carries RAW supplier categories from
  the old bulk imports, unlike staging's simplified taxonomy — logged as env
  drift for the prod-reconcile task). Then 141 revisions / 5,380 items incl.
  Australis + Westan. **Prod total: 61,484 active items.**
- Provenance: every seeded item carries raw {vendor string, alternates, tab,
  section, updated, eta_notes}; per-SKU 'added' item_changes + 'import' audit
  events written. Future refreshes of these suppliers MUST use the MCP
  import_rows flow (they now have priors).

P4 record (20 Jul 2026) — Pricing Database app v1 (read-only), staging + prod:
- Backend: field-api `src/pricing.js` at `/api/pricing`, gated on the NEW
  `pricing` app grant (admins bypass; quotes grant deliberately NOT enough).
  Endpoints: /freshness (staleness vs pricelist_scan_config.stale_days,
  default 180), /suppliers, /search (same contract as the picker search),
  /revisions + /revisions/:id/changes. 6 route tests green. On quotes-v2 +
  staging branches; cherry-picked to master (366ddcc).
- **Staging deployed via plain `git pull` + compose rebuild** — first clean
  deploy since the checkout reconcile. Prod: file-copy pricing.js + in-place
  server.js patch (backup server.js.bak-p4) + rebuild, per prod convention
  until the prod checkout is reconciled.
- Frontend: src/pricing.html + src/js/pricing.js (Freshness board with
  traffic-light filters — the automated Update Schedule; Catalogue search;
  History with per-SKU change drill-down incl. old→new price). auth-gate now
  honours <html data-app-grant>. Browser-verified all views; cache-busters
  v=5. Deployed both envs.
- Launcher: "Pricing Database" tile + `pricing` entry in User Management's
  AVAILABLE_APPS — edited on-server in /opt/fieldapps{,-staging}/static/
  (backups *.bak-p4). NOTE: static/ launcher files are NOT in git (same
  disease as the old NUC-only code; add to the reconcile task).
- Freshness frequencies: 54 Update Schedule brands resolved → 28 matching
  suppliers got real stale_days (Monthly 40 / Quarterly 100 / Annual 380) in
  pricelist_scan_config, both envs (`data/pricing/scan-config.sql`).
- Remaining for P5: import-review UI + pricing.read/import/admin capability
  split + custodian grant; P6 automation.

Repo split record (20 Jul 2026): app moved out of SKS-Quotes-V2 into this
repo per Mark ("needs its own git"). Frontend now at /pricing/ (own Caddy
handle_path + www dir); the quotes repo keeps only the builder picker.

P5 redefined + shipped (20 Jul 2026): NO approval/import UI — Mark's call:
"the LLM drives this; I want it transparent". The app stays read-only; all
writes go through the MCP pricelist flow. Shipped instead:
- Supplier-centric front door: sortable/filterable supplier list (status dot,
  source kind, items, revisions, last import, age by urgency ratio) → click
  into a supplier: "How this supplier updates" (source kind + feed URL +
  cadence from pricelist_scan_config, now with source_kind/source_url columns
  — migration applied staging+prod), current pricing per scope, revision
  history with per-SKU diffs, recent audit activity.
- Freshness board: sortable columns + text filter; rows click through to the
  supplier.
- Activity tab: pending AI-staged imports (pricelist_file_scans) + the full
  audit timeline with actor attribution. /api/pricing/activity + /suppliers/:id
  added (9 route tests green).
- Alloys configured as the first feed supplier (CSV feed URL + 40d cadence in
  scan_config, both envs) — switchover import itself still to run.
