#!/usr/bin/env python3
"""P3 generator: Master BoM + P2 maps -> data/seed.sql.

Seeds ONLY suppliers with no live pricelist (P2 registry, approved 20 Jul 2026).
These are all first imports — no supersedence — so the remaining pipeline
guardrails are applied here deterministically: numeric-price requirement,
per-supplier SKU dedupe (first occurrence wins), canonical taxonomy categories
from the tab map. The SQL is idempotent (ON CONFLICT / NOT EXISTS guards) and
matches suppliers by CODE so the same file applies to staging and prod.

Future refreshes of these suppliers MUST go through pricelist_import_rows —
they will have priors and need the supersede preview.

Usage: python3 dev/build-seed-sql.py "/path/to/Master BoM.xlsx"
"""
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
REV_LABEL = 'Master BoM seed — Jul 2026'
FILENAME = 'Master BoM (1).xlsx'

# Suppliers with live pricelists (prod, 20 Jul 2026) — never seeded.
LIVE = {'Amber Technology', 'MadisonAV', '4Cabling', 'Jands', 'Audio Brands Australia',
        'AVAD', 'PAVT', 'Cisco', 'Midwich', 'NAS Australia', 'Audio Visual Distributors',
        'Crestron', 'Kramer', 'Technical Audio Group', 'Biamp', 'Lindy', 'Anixter (Wesco)',
        'Kordz', 'Atdec', 'Lightware', 'Epson', 'Logitech', 'Samsung', 'EZYmount',
        'Sennheiser', 'Inogeni'}

# Canonical name -> existing store code, where slugification wouldn't match.
CODE_OVERRIDES = {'Westan': 'WESTAN', 'Australis Pro Audio': 'AUSTRALIS'}

META_TABS = {'Contacts', 'Deal Reg', 'Labour Rates 24.25', 'Labour Rates 25.26', 'Update Schedule'}


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def code_of(name):
    if name in CODE_OVERRIDES:
        return CODE_OVERRIDES[name]
    return re.sub(r'[^A-Z0-9]', '', name.upper())[:24] or 'X'


def parse_cost(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 2) if float(v) >= 0 else None
    s = re.sub(r'[$,\s]', '', str(v))
    try:
        f = float(s)
        return round(f, 2) if f >= 0 else None
    except ValueError:
        return None


def iso(v):
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d')
    return str(v).strip() if v not in (None, '') else None


def main():
    bom = sys.argv[1] if len(sys.argv) > 1 else '/Users/mark/Documents/Master BoM (1).xlsx'
    vmap = json.load(open(ROOT / 'data/bom-vendor-map.json'))['vendor_map']
    cmap = json.load(open(ROOT / 'data/bom-category-map.json'))['tab_category']

    wb = openpyxl.load_workbook(bom, read_only=True, data_only=True)
    batches = defaultdict(list)          # (supplier, scope) -> rows
    seen = defaultdict(set)              # (supplier, scope) -> skus
    stats = defaultdict(int)
    for ws in wb.worksheets:
        if ws.title in META_TABS or cmap.get(ws.title) is None:
            continue
        category = cmap[ws.title]
        section = ''
        for row in ws.iter_rows(min_row=2, values_only=True):
            if len(row) < 5:
                continue
            brand, vendor, model, desc, cost = row[0], row[1], row[2], row[3], row[4]
            upd = row[5] if len(row) > 5 else None
            eta = row[6] if len(row) > 6 else None
            has_model = model is not None and str(model).strip() != ''
            has_cost = cost is not None and str(cost).strip() != ''
            if not has_model and not has_cost:
                first = next((c for c in row if c is not None and str(c).strip()), None)
                if first:
                    section = str(first).strip()
                continue
            if not (has_model and has_cost):
                stats['rows_incomplete'] += 1
                continue
            v = str(vendor).strip() if vendor and str(vendor).strip() else '(blank)'
            m = vmap.get(v) or vmap.get(re.sub(r'\s+', ' ', v))
            if not m or m['action'] != 'import':
                stats['rows_skipped_vendor'] += 1
                continue
            supplier = m['supplier']
            if supplier in LIVE:
                stats['rows_excluded_live'] += 1
                continue
            price = parse_cost(cost)
            if price is None:
                stats['rows_unpriced'] += 1
                continue
            sku = str(model).strip()
            scope = m.get('scope') or ''
            key = (supplier, scope)
            if sku.lower() in seen[key]:
                stats['rows_duplicate_sku'] += 1
                continue
            seen[key].add(sku.lower())
            description = str(desc).strip() if desc and str(desc).strip() else sku
            raw = {'vendor': v, 'alternates': m.get('alternates', []),
                   'tab': ws.title, 'section': section or None,
                   'updated': iso(upd), 'eta_notes': iso(eta),
                   'seed': 'bom-p3-2026-07-20'}
            batches[key].append({
                'sku': sku, 'description': description[:1000],
                'brand': (str(brand).strip()[:200] if brand and str(brand).strip() else None),
                'category': category,
                'source_category': f"{ws.title} › {section}" if section else ws.title,
                'cost': price, 'raw': raw,
            })
            stats['rows_seeded'] += 1

    out = [
        f'-- P3 seed generated {date.today().isoformat()} from {FILENAME}',
        f'-- {stats["rows_seeded"]} rows across {len(batches)} supplier×scope batches. Idempotent.',
        'BEGIN;',
    ]
    suppliers = sorted({s for s, _ in batches})
    vals = ',\n'.join(f"  ({q(code_of(s))}, {q(s)}, true, 0)" for s in suppliers)
    out.append('INSERT INTO quotes.suppliers (code, name, is_active, sort_order)\nVALUES\n'
               + vals + '\nON CONFLICT (code) DO NOTHING;')

    for (supplier, scope), rows in sorted(batches.items(), key=lambda kv: -len(kv[1])):
        code, scope_sql = code_of(supplier), (q(scope) if scope else 'NULL')
        n = len(rows)
        out.append(f"""
-- {supplier}{' / ' + scope if scope else ''}: {n} rows
INSERT INTO quotes.pricelist_revisions (supplier_id, scope_label, revision_label, filename, is_active, summary)
SELECT s.id, {scope_sql}, {q(REV_LABEL)}, {q(FILENAME)}, true,
       jsonb_build_object('added', {n}, 'changed', 0, 'removed', 0, 'unchanged', 0, 'row_count', {n}, 'source', 'bom-seed-p3')
  FROM quotes.suppliers s
 WHERE s.code = {q(code)}
   AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_revisions pr
                    WHERE pr.supplier_id = s.id AND COALESCE(pr.scope_label,'') = {q(scope)} AND pr.is_active);""")
        values = ',\n'.join(
            '  ({}, {}, {}, {}, {}, {}, {})'.format(
                q(r['sku']), q(r['description']),
                q(r['brand']) if r['brand'] else 'NULL',
                q(r['category']), q(r['source_category']),
                r['cost'], q(json.dumps(r['raw'], ensure_ascii=False)))
            for r in rows)
        out.append(f"""WITH rev AS (
  SELECT pr.id AS rid, pr.supplier_id AS sid
    FROM quotes.pricelist_revisions pr JOIN quotes.suppliers s ON s.id = pr.supplier_id
   WHERE s.code = {q(code)} AND COALESCE(pr.scope_label,'') = {q(scope)}
     AND pr.revision_label = {q(REV_LABEL)} AND pr.is_active
)
INSERT INTO quotes.supplier_pricelist_items
  (supplier_id, sku, description, brand, category, source_category, cost_price, uom,
   is_active, revision_id, short_description, raw)
SELECT rev.sid, v.sku, v.description, v.brand, v.category, v.source_category, v.cost, 'each',
       true, rev.rid, v.sku, v.raw::jsonb
  FROM rev, (VALUES
{values}
  ) AS v(sku, description, brand, category, source_category, cost, raw)
ON CONFLICT (supplier_id, sku, revision_id) DO NOTHING;""")

    out.append(f"""
-- per-SKU 'added' audit rows + import audit events for every seed revision
INSERT INTO quotes.pricelist_item_changes (revision_id, change_kind, sku, description, after)
SELECT spi.revision_id, 'added', spi.sku, spi.description,
       jsonb_build_object('sku', spi.sku, 'cost_price', spi.cost_price, 'category', spi.category)
  FROM quotes.supplier_pricelist_items spi
  JOIN quotes.pricelist_revisions pr ON pr.id = spi.revision_id
 WHERE pr.revision_label = {q(REV_LABEL)} AND pr.is_active
   AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_item_changes c
                    WHERE c.revision_id = spi.revision_id AND c.sku = spi.sku);
INSERT INTO quotes.pricelist_audit_events (action, supplier_id, revision_id, reason, details)
SELECT 'import', pr.supplier_id, pr.id, 'Master BoM seed (P3, approved by Mark 20 Jul 2026)',
       jsonb_build_object('source', {q(FILENAME)}, 'rows', (pr.summary->>'row_count')::int)
  FROM quotes.pricelist_revisions pr
 WHERE pr.revision_label = {q(REV_LABEL)} AND pr.is_active
   AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_audit_events e
                    WHERE e.revision_id = pr.id AND e.action = 'import');
COMMIT;""")

    sql = '\n'.join(out) + '\n'
    (ROOT / 'data/seed.sql').write_text(sql)
    top = sorted(((s, len(r)) for (s, sc), r in batches.items()), key=lambda kv: -kv[1])[:12]
    print(json.dumps({'stats': dict(stats), 'batches': len(batches),
                      'suppliers': len(suppliers), 'top': top,
                      'sql_bytes': len(sql)}, indent=1))


if __name__ == '__main__':
    main()
