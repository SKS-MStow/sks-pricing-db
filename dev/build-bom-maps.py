#!/usr/bin/env python3
"""P2 generator: Master BoM -> data/bom-vendor-map.json + bom-category-map.json.

Reads the Master BoM workbook, normalises every distinct Vendor string to a
canonical supplier (+ optional scope + alternates), maps every category tab to
the frozen 12-value pricelist taxonomy, and writes the machine-readable maps
the P3 seed import consumes. SUPPLIER-REGISTRY.md is the human review doc —
regenerate the tables there after editing the rules here.

Usage: python3 dev/build-bom-maps.py "/path/to/Master BoM.xlsx"
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

META_TABS = {'Contacts', 'Deal Reg', 'Labour Rates 24.25', 'Labour Rates 25.26', 'Update Schedule'}

# Tab -> simplified taxonomy (design: pricelist-guardrails.js). Tabs mapping to
# None are excluded from the seed import.
CATEGORY_MAP = {
    'Sources': 'Video & Displays',
    'Signage & IPTV': 'Video & Displays',
    'LCD Screens': 'Video & Displays',
    'dvLED Display': 'Video & Displays',
    'Control': 'Control & Automation',
    'Projectors': 'Video & Displays',
    'Mounts': 'Racks, Mounts & Structure',
    'Audio - Amps': 'Audio',
    'Audio - Microphones': 'Audio',
    'Audio - Speakers': 'Audio',
    'Audio - DSP': 'Audio',
    'Hearing Aug': 'Audio',
    'Room Booking Panels': 'Conferencing & Collaboration',
    'Cable Rolls (Per Meter)': 'Cabling & Connectivity',
    'Cables': 'Cabling & Connectivity',
    'Switching & Distribution': 'Video & Displays',
    'AVoIP': 'Video & Displays',
    'Networking': 'Networking',
    'USB': 'Cabling & Connectivity',
    'VC': 'Conferencing & Collaboration',
    'Broadcast': 'Video & Displays',
    'Hardware': 'Racks, Mounts & Structure',
    'Lighting': 'Control & Automation',
    'Floor Track': 'Racks, Mounts & Structure',
    'Table Boxes': 'Cabling & Connectivity',
    'Sound Masking': 'Audio',
    'TEMP - GCEC Panels & Patch': None,   # project-specific temp tab
    'TEMP - GCEC Cables': None,           # project-specific temp tab
}

# Exact-string alias -> canonical supplier name. Applied to each token after
# splitting a multi-vendor string on '/'. Canonical names follow the live
# store's quotes.suppliers naming where the supplier already exists there.
ALIASES = {
    'amber': 'Amber Technology',
    'amber tech': 'Amber Technology',
    'amber technology': 'Amber Technology',
    'madison': 'MadisonAV',
    'madison av': 'MadisonAV',
    'madison tech': 'MadisonAV',
    'madisonav': 'MadisonAV',
    'anixter': 'Anixter (Wesco)',
    'wesco anixter': 'Anixter (Wesco)',
    'nas': 'NAS Australia',
    'nas solutions': 'NAS Australia',
    'nas australia': 'NAS Australia',
    'australis': 'Australis Pro Audio',
    'audio brands': 'Audio Brands Australia',
    'avd': 'Audio Visual Distributors',
    'tag': 'Technical Audio Group',
    'group tech': 'Group Technologies',
    'radio parts': 'Radio Parts',
    'radioparts': 'Radio Parts',
    'quantum': 'Quantum Sphere',
    'quantum sphere': 'Quantum Sphere',
    'dicker': 'Dicker Data',
    'dicker (das)': 'Dicker Data',
    'dicker data': 'Dicker Data',
    'ingram': 'Ingram Micro',
    'ingram micro': 'Ingram Micro',
    'bluechip': 'BlueChip Infotech',
    'leader': 'Leader Computers',
    'leeder': 'Leader Computers',
    'comms plus': 'CommsPlus',
    'commsplus': 'CommsPlus',
    'vision chart': 'VisionChart',
    'visionchart': 'VisionChart',
    'cms': 'CMS Electracom',
    'cms electracom': 'CMS Electracom',
    'cms electacom': 'CMS Electracom',
    'opie': 'OPIE',
    'tech core': 'Technology Core',
    'technology core': 'Technology Core',
    'swamp': 'Swamp Industries',
    'swamp industries': 'Swamp Industries',
    'convergent tech': 'Convergent Technologies',
    'convergent technologies': 'Convergent Technologies',
    'avw broadcast': 'AVW Broadcast',
    'avw broadcast group': 'AVW Broadcast',
    'electus': 'Electus',
    'electus (jaycar / radio parts)': 'Electus',
    'electus / jaycar': 'Electus',
    'jands / radio parts': 'Jands',  # kept whole: Blustream primary channel
    'midwich / av supply': 'Midwich',
    'l&h pacific data': 'L&H',
    'l & h (pac data)': 'L&H',
    'pacific data': 'Pacific Datacom',
    'atdec': 'Atdec',
    'audio active only': 'Audio Active',
    'ezymount': 'EZYmount',
    'lindy/midwich': 'Lindy',
    'jands/ dicker': 'Jands',
    'synnex/madison': 'Synnex',
    'blonde robot/midwich': 'Blonde Robot',
    'vitek': 'Vitec',
    'vitec': 'Vitec',
    'rs-online': 'RS Components',
    'rs components': 'RS Components',
    'seltec': 'Seltec',
    'sektor': 'Sektor',
    'adi (snapone)': 'ADI Global (Snap One)',
    'adi (snap one)': 'ADI Global (Snap One)',
    'adi global': 'ADI Global (Snap One)',
    'adi global / westan': 'ADI Global (Snap One)',
    'jb': 'JB Hi-Fi',
    'jb hi-fi': 'JB Hi-Fi',
    'ingram - jb hi-fi': 'Ingram Micro',
    'nec': 'NEC',
    'yamaha': 'Yamaha',
    'sony': 'Sony',
    'samsung': 'Samsung',
    'crestron': 'Crestron',
    'kramer': 'Kramer',
    'sennheiser': 'Sennheiser',
    'lightware': 'Lightware',
    'lindy': 'Lindy',
    'westan': 'Westan',
    'midwich': 'Midwich',
    'epson': 'Epson',
    'kordz': 'Kordz',
    '4cabling': '4Cabling',
    'pavt': 'PAVT',
    'avad': 'AVAD',
    'inogeni': 'Inogeni',
    'logitech': 'Logitech',
    'cisco': 'Cisco',
    'biamp': 'Biamp',
    'extron': 'Extron',
    'jands': 'Jands',
    'canohm': 'Canohm',
    'screen technics': 'Screen Technics',
    'altronics': 'Altronics',
    'barco': 'Barco',
    'appspace': 'Appspace',
    'corsair': 'Corsair',
    'group technologies': 'Group Technologies',
    'synnex': 'Synnex',
    'alloys': 'Alloys',
    'mmt': 'MMT',
    'wbt': 'WBT',
    'xit': 'XIT',
    'middys': 'Middys',
    'rexel': 'Rexel',
    'l&h': 'L&H',
    'ula group': 'ULA Group',
    'tradezone': 'TradeZone',
}

# Vendor strings where the FIRST token is a brand riding along, not the vendor
# — the real primary channel is elsewhere in the string (or fixed here).
PRIMARY_OVERRIDES = {
    'TCL / AVAD': 'AVAD',
    'Unilumin / AVAD': 'AVAD',
    'Roland / Amber Tech / AVAD': 'Amber Technology',
    'CSR - Himmel Interiors': 'CSR (Himmel Interiors)',
    'Anixter - Middys / Rexel / L&H': 'Anixter (Wesco)',
    'Anixter - AWM / L&H / Pacific Data / Middys': 'Anixter (Wesco)',
    'Synnex (Crestron / Madison / TAG / Biamp / Dicker / AVD / Audio Brands)': 'Synnex',
    'ORDER FROM Synnex (Madison / TAG / Dicker / AVD / Audio Brands)': 'Synnex',
    'Synnex - XIT / Dynamic / AV Supply': 'Synnex',
    'Ingram - JB Hi-Fi / Officeworks': 'Ingram Micro',
    'Ingram /Commsplus / Leading Solutions/Auroz': 'Ingram Micro',
    'Ingram / Commsplus / Leading Solutions / Auroz': 'Ingram Micro',
    'Ingram / Dicker (DAS)': 'Ingram Micro',
    'Dicker / BCIT': 'Dicker Data',
    'Dicker / Ingram (DAS)': 'Dicker Data',
    'SONY SPECIAL REQUEST': 'Sony',
    'Audio Active / JB': 'Audio Active',
    'Biamp / AVD': 'Biamp',
    'Yamaha / Amber': 'Yamaha',
    'Yamaha / AVAD': 'Yamaha',
    'AVAD / Yamaha': 'AVAD',
    'AVAD / Masimo': 'AVAD',
    'Electus (Jaycar / Radio Parts)': 'Electus',
    'Madison / 45dB': 'MadisonAV',
}

# Deal-reg / channel tiers -> (canonical supplier, scope label).
SCOPES = {
    'Biamp 0%': ('Biamp', 'deal-reg-0'),
    'Biamp 5%': ('Biamp', 'deal-reg-5'),
    'Biamp 10%': ('Biamp', 'deal-reg-10'),
    'SONY SPECIAL REQUEST': ('Sony', 'special-request'),
}

# Vendor strings that must not be imported at all.
SKIP = {
    'DONT ORDER': 'marked do-not-order in the BoM',
    'DON’T ORDER': 'marked do-not-order in the BoM',
    'DONT ORDER / Ingram / ALD': 'marked do-not-order in the BoM',
    '(blank)': 'no vendor recorded — needs manual assignment',
    '': 'no vendor recorded — needs manual assignment',
    '????': 'vendor unknown in the BoM',
    'TBC': 'vendor still to be confirmed in the BoM',
}

SKS_INTERNAL_PREFIXES = ('SKS Custom', 'SKS /', 'SKS')
RETAILERS = {'JB Hi-Fi', 'Bunnings', 'Amazon', 'Officeworks', 'Jaycar', 'Big W', 'B&H Online', 'Store DJ', 'DJ City', 'Selby', 'Capisco', 'Mouser', 'Secure Entertainment'}


def canon_token(tok):
    t = re.sub(r'\s+', ' ', tok.strip())
    return ALIASES.get(t.lower(), t) if t else None


def resolve(vendor):
    """vendor string -> dict(action, supplier?, scope?, alternates?, note?)."""
    v = re.sub(r'\s+', ' ', str(vendor).strip())
    if v in SKIP or v.strip() in SKIP:
        return {'action': 'skip', 'note': SKIP.get(v, SKIP.get(v.strip()))}
    if v == 'OFE':
        return {'action': 'import', 'supplier': 'OFE (Client Supplied)', 'alternates': []}
    if v.startswith('SKS Custom'):
        return {'action': 'import', 'supplier': 'SKS Custom', 'alternates': [],
                'note': 'internal fabrication; panel spec lives in the vendor string: ' + v}
    if v in SCOPES:
        sup, scope = SCOPES[v]
        return {'action': 'import', 'supplier': sup, 'scope': scope, 'alternates': []}
    if v in PRIMARY_OVERRIDES:
        # No token-split for overrides — these strings contain parens/hyphens
        # that a naive '/' split shreds. The full original string rides into
        # the import's raw payload anyway, so alternates aren't lost.
        return {'action': 'import', 'supplier': PRIMARY_OVERRIDES[v], 'alternates': []}
    whole = canon_token(v)
    if whole and whole != v and '/' in v:
        # a multi-vendor-looking string that is really one channel (aliased whole)
        return {'action': 'import', 'supplier': whole, 'alternates': []}
    toks = [canon_token(t) for t in v.split('/')]
    toks = [t for t in toks if t]
    if not toks:
        return {'action': 'skip', 'note': 'empty vendor string'}
    primary, alts = toks[0], toks[1:]
    out = {'action': 'import', 'supplier': primary, 'alternates': alts}
    if primary in RETAILERS:
        out['note'] = 'retail channel'
    return out


def main():
    bom = sys.argv[1] if len(sys.argv) > 1 else '/Users/mark/Documents/Master BoM (1).xlsx'
    root = Path(__file__).resolve().parent.parent
    outdir = root / 'data'
    outdir.mkdir(parents=True, exist_ok=True)

    wb = openpyxl.load_workbook(bom, read_only=True, data_only=True)
    vendor_rows = defaultdict(int)
    vendor_tabs = defaultdict(set)
    tab_rows = defaultdict(int)
    for ws in wb.worksheets:
        if ws.title in META_TABS:
            continue
        for row in ws.iter_rows(min_row=2, values_only=True):
            if len(row) < 5:
                continue
            brand, vendor, model, desc, cost = row[0], row[1], row[2], row[3], row[4]
            if model and cost is not None and str(cost).strip() != '':
                v = str(vendor).strip() if vendor and str(vendor).strip() else '(blank)'
                vendor_rows[v] += 1
                vendor_tabs[v].add(ws.title)
                tab_rows[ws.title] += 1

    vendor_map = {}
    suppliers = defaultdict(lambda: {'rows': 0, 'variants': [], 'scopes': set(), 'alternate_rows': 0})
    skipped = {}
    for v, n in sorted(vendor_rows.items(), key=lambda kv: -kv[1]):
        r = resolve(v)
        vendor_map[v] = {**r, 'rows': n, 'tabs': sorted(vendor_tabs[v])}
        if r['action'] == 'import':
            s = suppliers[r['supplier']]
            s['rows'] += n
            s['variants'].append(v)
            if r.get('scope'):
                s['scopes'].add(r['scope'])
            for a in r.get('alternates', []):
                suppliers[a]['alternate_rows'] += n
        else:
            skipped[v] = {'rows': n, 'note': r.get('note', '')}

    (outdir / 'bom-vendor-map.json').write_text(json.dumps({
        'source': Path(bom).name,
        'vendor_map': vendor_map,
    }, indent=1, ensure_ascii=False))
    (outdir / 'bom-category-map.json').write_text(json.dumps({
        'source': Path(bom).name,
        'taxonomy_note': 'values must match SIMPLIFIED_PRICELIST_CATEGORIES in field-api/src/pricelist-guardrails.js',
        'tab_category': CATEGORY_MAP,
        'tab_rows': dict(sorted(tab_rows.items())),
    }, indent=1, ensure_ascii=False))

    reg = {k: {'rows': v['rows'], 'alternate_rows': v['alternate_rows'],
               'scopes': sorted(v['scopes']), 'variants': v['variants']}
           for k, v in sorted(suppliers.items(), key=lambda kv: -kv[1]['rows'])}
    (outdir / 'supplier-registry.json').write_text(json.dumps({
        'suppliers': reg, 'skipped': skipped,
    }, indent=1, ensure_ascii=False))

    n_primary = len([s for s in suppliers.values() if s['rows']])
    print(f"vendor strings: {len(vendor_rows)}  -> suppliers as primary: {n_primary} "
          f"(+{len(suppliers) - n_primary} alternate-only)")
    print(f"rows importable: {sum(v['rows'] for v in suppliers.values())}  "
          f"skipped: {sum(s['rows'] for s in skipped.values())} across {len(skipped)} strings")


if __name__ == '__main__':
    main()
