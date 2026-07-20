# SKS Pricing Database

Standalone field app: supplier pricing store UI — freshness board, catalogue
browser, revision history. Split out of SKS-Quotes-V2 on 20 Jul 2026 (the
quote builder's picker still reads the same store via its own API).

## Read first
- `PLAN.md` — the phased plan (P1–P6) and per-phase records. P1–P4 done;
  next is P5 (import-review UI + pricing.read/import/admin capability split),
  then P6 (staleness cron + supplier API connectors).
- `data/SUPPLIER-REGISTRY.md` — the signed-off vendor→supplier + category
  mapping behind the Master BoM seed; regenerate via `dev/build-bom-maps.py`.

## Stack & conventions
- Vanilla HTML/CSS/JS, no framework, no build step — same pattern as every
  SKS field app. `src/index.html` + ES modules in `src/js/`, tokens in
  `src/css/theme.css` (copied from SKS-Quotes-V2; purple `#7C77B9` accents,
  navy structural ink, Roboto/Mulish).
- **Backend lives in field-api** (`src/pricing.js`, mounted at `/api/pricing`,
  branch flow: quotes-v2 → staging → cherry-pick to master). Read-only v1;
  writes go through the pricelist_* MCP flow. Access = the `pricing` app grant
  (admins bypass); the quotes grant is deliberately NOT enough.
- Data store: schema `quotes` in the shared `fieldapps` Postgres —
  suppliers / pricelist_revisions / supplier_pricelist_items /
  pricelist_item_changes / pricelist_audit_events / pricelist_scan_config
  (stale_days drives the freshness board; DDL still lives in
  `sks-quotes/server/migrations/`, applied by hand, staging first).

## Deploy
- Frontend: rsync `src/` → NUC `/opt/fieldapps{,-staging}/www/sks-pricing-db/src/`;
  Caddy serves it at `/pricing/` (handle_path block in
  `/opt/fieldapps{,-staging}/compose/Caddyfile`). Straight to prod (Mark,
  20 Jul 2026 — same convention as Quotes V2); staging gets the same deploy.
- **Asset versioning: bump `?v=N` on every JS deploy** (Cloudflare rewrites
  no-cache to a 4 h browser TTL):
  `perl -pi -e 's/\.js\?v=\d+/.js?v=<NEW>/g' src/js/*.js src/*.html`
- Launcher tile ("Pricing Database") + User Management entry live in
  `/opt/fieldapps{,-staging}/static/` on the NUC — NOT in any git repo yet.

## Local preview
`node dev/mock-api-server.js src 4175` (launch config `pricing-mock`) —
serves `src/` plus an in-memory `/api/pricing` + `/api/auth/me` contract.

## Money & entities
All prices ex GST, AUD, `en-AU` formatting. Supplier cost data is
commercially sensitive — never publish outside SKS systems.
