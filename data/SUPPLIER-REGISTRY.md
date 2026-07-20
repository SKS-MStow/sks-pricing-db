# Supplier registry & BoM mapping — P2 review document

*Generated 20 Jul 2026 from `Master BoM (1).xlsx` by `dev/build-bom-maps.py`.
This is the sign-off gate before the P3 seed import (PRICING-DB-PLAN.md §6–7).
The machine-readable versions the import consumes are `bom-vendor-map.json`
(exact vendor string → supplier/scope/action) and `bom-category-map.json`.*

**Mark: review the decisions in §1, skim the tables, then sign off (or edit
the rules in `dev/build-bom-maps.py` and regenerate).** Nothing is imported
until this doc is approved.

## 0. Summary

- 11,156 BoM rows → **11,105 importable**, 51 skipped (do-not-order / no vendor / TBC).
- 374 distinct vendor strings → **172 canonical suppliers** (75 main ≥20 rows
  covering 10,412 rows; 57 mid-tail; 40 micro-tail) + 21 names that appear only
  as alternate channels.
- **The live store already holds ~56,000 active items across 26 suppliers**
  (bulk MCP imports, May–Jun 2026) — for every one of those the live pricelist
  is larger and fresher than the BoM tab, so they are NOT re-seeded. The BoM
  seed targets the ~85 suppliers the store lacks (Dicker Data 700 rows, Extron
  374, Quantum Sphere 442, Ingram Micro 300, Synnex 177…) — 151 suppliers, 5,622 rows.
- Suppliers are matched to the store by **code** (stable across environments);
  prod display names sometimes differ from staging ("Madison Technologies" vs
  "MadisonAV", "LWR AU" vs "Lightware") — cosmetic, worth unifying later.
- Biamp's three deal-reg tiers become scopes (`deal-reg-0/5/10`) on one Biamp
  supplier — same mechanism the store already uses for tiered suppliers.

## 1. Decisions needing Mark

1. **Multi-vendor strings** (`Dicker / Ingram / Synnex`): the row imports
   against the FIRST-listed vendor; the full original string + parsed
   alternates ride along in the item's `raw` payload, so nothing is lost and a
   proper multi-sourcing model can be built later (plan §8).
   *Proposed: accept.*
2. **Category taxonomy**: the 28 tabs map onto the frozen 12-value taxonomy
   (§ tab table). Three tabs are judgement calls — Switching & Distribution +
   AVoIP → *Video & Displays*, Lighting → *Control & Automation*, Broadcast →
   *Video & Displays*. Alternative: extend the taxonomy (e.g. a "Signal
   Distribution" category) — one deliberate decision, applies from P3 onward.
   *Proposed: keep the frozen 12 for the seed; revisit only if the picker
   filters feel wrong in practice.* Each row also carries
   `source_category = "Tab › Section"` so nothing is flattened permanently.
3. **Do-not-order rows (26)** are excluded; **no-vendor/TBC/???? rows (25)**
   are excluded and listed for manual fix-up in the BoM.
   *Proposed: accept; fix the BoM at your leisure and re-run.*
4. **Retail-channel rows** (JB Hi-Fi, Bunnings, Amazon, Officeworks…): imported
   under the first-named retailer as supplier, flagged `retail channel`.
   *Alternative: one bucket supplier "Retail". Proposed: first-named retailer.*
5. **SKS-internal rows**: `SKS Custom` patch panels (13 rows) import under
   supplier **SKS Custom**; `OFE` client-supplied under **OFE (Client
   Supplied)** at $0. *Proposed: accept.*
6. **Existing store naming**: canonical names follow the live store where a
   supplier exists (`Amber Tech` → **Amber Technology**, `Madison` →
   **MadisonAV**, `TAG` → **Technical Audio Group**, `Anixter` → **Anixter
   (Wesco)**…). Note the live Midwich has code `Midwich Platinum` — tier baked
   into the code field; leave as-is for now.
7. **Sony special channels**: `SONY SPECIAL REQUEST` → supplier Sony, scope
   `special-request`; `Audio Active` (Sony retail specialist) stays its own
   supplier. *Proposed: accept.*

## 2. What the import will do with this (P3 preview)

Per supplier×scope: gather rows from all tabs, dedupe SKUs (BoM has repeats
across tabs — first occurrence wins, duplicates logged), post one
`pricelist_import_rows` call with `effective_date` from the row's Updated
column, review the supersede preview, commit. Guardrails reject >50%
Uncategorised or <70% price coverage per batch. **Suppliers that already have
live pricelists (Crestron, Biamp, MadisonAV, Sennheiser…) are NOT seeded from
the BoM by default** — their MCP-imported pricelists are fresher than the BoM;
the BoM seed fills the suppliers the store doesn't have yet. Exceptions can be
made per supplier at import time with the supersede preview as the safety net.

<!-- stats: primaries=172 big=75 mid=57 tail=40 live-matched=24 -->

### Main suppliers (≥20 BoM rows) — 75 suppliers, 10412 rows

| Supplier | Store (code) | Live items | BoM rows | Seed? | Scopes | BoM vendor-string variants |
|---|---|---:|---:|---|---|---|
| **Dicker Data** | ➕ new | — | 700 | **yes** | — | `Dicker / Bluechip`; `Dicker / Ingram / Alloys`; `Dicker / Ingram / Synnex` +19 |
| **Jands** | ✅ `JANDS` | 3,763 (May 2026) | 675 | no — live fresher | — | `Jands`; `Jands / Radio Parts`; `Jands / Dicker` +2 |
| **Midwich** | ✅ `Midwich Platinum` | 2,980 (May 2026) | 513 | no — live fresher | — | `Midwich / AV Supply`; `Midwich`; `Midwich / Dicker / Ingram / WBT` +14 |
| **Amber Technology** | ✅ `AMBERTECHNOL` | 9,651 (Jun 2026) | 498 | no — live fresher | — | `Amber Tech`; `Amber`; `Amber Technology` +4 |
| **MadisonAV** | ✅ `MADISONAV` | 7,523 (May 2026) | 478 | no — live fresher | — | `Madison`; `Madison AV`; `Madison / 45dB` +6 |
| **Quantum Sphere** | ➕ new | — | 442 | **yes** | — | `Quantum / Alloys / Dicker / Midwich`; `Quantum Sphere`; `Quantum / Alloys / MMT / AVD / XIT` +8 |
| **Kramer** | ✅ `KRAMER` | 1,297 (May 2026) | 438 | no — live fresher | — | `Kramer` |
| **Crestron** | ✅ `CRESTRON` | 1,493 (May 2026) | 431 | no — live fresher | — | `Crestron` |
| **Extron** | ➕ new | — | 374 | **yes** | — | `Extron` |
| **Technical Audio Group** | ✅ `TAG` | 1,269 (May 2026) | 343 | no — live fresher | — | `TAG` |
| **Biamp** | ✅ `BIAMP` | 1,200 (May 2026) | 333 | no — live fresher | deal-reg-0, deal-reg-10, deal-reg-5 | `Biamp 5%`; `Biamp 0%`; `Biamp 10%` +2 |
| **Anixter (Wesco)** | ✅ `ANX` | 666 (May 2026) | 308 | no — live fresher | — | `Anixter`; `Anixter - Middys / Rexel / L&H`; `Anixter / Uptime Systems` +4 |
| **Ingram Micro** | ➕ new | — | 300 | **yes** | — | `Ingram / Dicker / Westcon`; `Ingram / Dicker / Westcon / MMT`; `Ingram` +10 |
| **Lindy** | ✅ `LINDY` | 1,181 (May 2026) | 273 | no — live fresher | — | `Lindy`; `Lindy / Midwich`; `Lindy / Midwich / Anixter` +3 |
| **NAS Australia** | ✅ `NASAUSTRALIA` | 2,183 (May 2026) | 210 | no — live fresher | — | `NAS`; `NAS Solutions`; `NAS / ULA Group` |
| **Audio Visual Distributors** | ✅ `AVD` | 1,767 (May 2026) | 197 | no — live fresher | — | `AVD`; `AVD / Dicker`; `AVD / Showlogic` +1 |
| **Kordz** | ✅ `KORDZ` | 576 (May 2026) | 186 | no — live fresher | — | `Kordz` |
| **Canohm** | ➕ new | — | 180 | **yes** | — | `Canohm` |
| **Synnex** | ➕ new | — | 177 | **yes** | — | `Synnex`; `Synnex - XIT / Dynamic / AV Supply`; `Synnex (Crestron / Madison / TAG / Biamp / Dicker / AVD / Audio Brands)` +10 |
| **Westan** | ✅ `WESTAN` | 0 | 159 | **yes** | — | `Westan`; `Westan / Madison` |
| **Alloys** | ➕ new | — | 156 | **yes** | — | `Alloys / Westan / Midwich / Dicker`; `Alloys / Quantum / Midwich / MMT`; `Alloys` +7 |
| **Sennheiser** | ✅ `SENNHEISER` | 42 (May 2026) | 153 | **yes** — BoM larger | — | `Sennheiser` |
| **Audio Brands Australia** | ✅ `AUDIOBRANDS` | 3,600 (May 2026) | 150 | no — live fresher | — | `Audio Brands`; `Audio Brands / Audio Logistics` |
| **Australis Pro Audio** | ✅ `AUSTRALIS` | 0 | 148 | **yes** | — | `Australis` |
| **Yamaha** | ➕ new | — | 125 | **yes** | — | `Yamaha`; `Yamaha / Amber`; `Yamaha / AVAD` |
| **Seltec** | ➕ new | — | 122 | **yes** | — | `Seltec`; `Seltec / Synnex`; `Seltec / Rexel` |
| **BlueChip Infotech** | ➕ new | — | 116 | **yes** | — | `Bluechip / Leader / CommsPlus / Dicker / Madison`; `Bluechip / Madison / Leader / Dicker / BTC`; `Bluechip / Dicker` +4 |
| **Screen Technics** | ➕ new | — | 114 | **yes** | — | `Screen Technics` |
| **Altronics** | ➕ new | — | 113 | **yes** | — | `Altronics` |
| **Radio Parts** | ➕ new | — | 106 | **yes** | — | `Radio Parts`; `Radio Parts / Altronics`; `Radio Parts / Jands` +2 |
| **AVAD** | ✅ `AVAD` | 3,533 (May 2026) | 96 | no — live fresher | — | `TCL / AVAD`; `AVAD / Quantum / Alloys / MMT / XIT`; `AVAD / Masimo` +3 |
| **Group Technologies** | ➕ new | — | 92 | **yes** | — | `Group Technologies`; `Group Tech` |
| **Barco** | ➕ new | — | 82 | **yes** | — | `Barco` |
| **ECD** | ➕ new | — | 82 | **yes** | — | `ECD` |
| **Corsair** | ➕ new | — | 80 | **yes** | — | `Corsair`; `Corsair / AVD` |
| **Vitec** | ➕ new | — | 79 | **yes** | — | `Vitec`; `Vitek / Midwich`; `Vitec / Midwich` |
| **PAVT** | ✅ `PAVT` | 3,532 (May 2026) | 68 | no — live fresher | — | `PAVT`; `PAVT / CMI` |
| **Audio Logistics** | ➕ new | — | 65 | **yes** | — | `Audio Logistics`; `Audio Logistics / Audio Source / AVICO`; `Audio Logistics / Audio Source` |
| **Atdec** | ✅ `ATDEC` | 500 (May 2026) | 61 | no — live fresher | — | `Atdec / Dicker / MMT / Ingram`; `Atdec / MMT / Dicker / Ingram`; `Atdec / Dicker / MMT / Ingram / WBT` +1 |
| **Lightware** | ✅ `LIGHTWARE` | 395 (May 2026) | 56 | no — live fresher | — | `Lightware` |
| **Appspace** | ➕ new | — | 48 | **yes** | — | `Appspace` |
| **Blonde Robot** | ➕ new | — | 48 | **yes** | — | `Blonde Robot`; `Blonde Robot/Midwich`; `Blonde Robot / Synnex` |
| **UltraLift** | ➕ new | — | 47 | **yes** | — | `UltraLift` |
| **VisionChart** | ➕ new | — | 47 | **yes** | — | `VisionChart`; `Vision Chart` |
| **Middys** | ➕ new | — | 46 | **yes** | — | `Middys / Rexel / L&H`; `Middys` |
| **AV Supply** | ➕ new | — | 46 | **yes** | — | `AV Supply`; `AV Supply / AP Tech`; `AV Supply / Alloys` |
| **Technology Core** | ➕ new | — | 44 | **yes** | — | `Technology Core`; `Tech Core` |
| **Simplex** | ➕ new | — | 41 | **yes** | — | `Simplex` |
| **Pacific Datacom** | ➕ new | — | 40 | **yes** | — | `Pacific Data / Anixter`; `Pacific Data / Rexel` |
| **Riedel** | ➕ new | — | 39 | **yes** | — | `Riedel` |
| **CMS Electracom** | ➕ new | — | 37 | **yes** | — | `CMS Electracom`; `CMS Electacom`; `CMS` |
| **Leader Computers** | ➕ new | — | 35 | **yes** | — | `Leader`; `Leeder` |
| **ADI Global (Snap One)** | ➕ new | — | 34 | **yes** | — | `ADI Global / Westan`; `ADI (Snap One)`; `ADI Global` |
| **AVW Broadcast** | ➕ new | — | 33 | **yes** | — | `AVW Broadcast`; `AVW Broadcast Group`; `AVW Broadcast / Anixter` |
| **MMT** | ➕ new | — | 32 | **yes** | — | `MMT`; `MMT / Ingram` |
| **Alectro** | ➕ new | — | 32 | **yes** | — | `Alectro` |
| **Davis Legend** | ➕ new | — | 32 | **yes** | — | `Davis Legend / Rexel`; `Davis Legend / Rexel / Middys` |
| **Sektor** | ➕ new | — | 30 | **yes** | — | `Sektor`; `Sektor / Bluechip / Dicker` |
| **CBS** | ➕ new | — | 30 | **yes** | — | `CBS / Amber`; `CBS` |
| **New Magic** | ➕ new | — | 29 | **yes** | — | `New Magic` |
| **Kayell** | ➕ new | — | 29 | **yes** | — | `Kayell` |
| **Elgee** | ➕ new | — | 28 | **yes** | — | `Elgee`; `Elgee / Radio Parts` |
| **Avation** | ➕ new | — | 27 | **yes** | — | `Avation`; `Avation / AV Supply` |
| **Screen Mounts** | ➕ new | — | 25 | **yes** | — | `Screen Mounts / Alloys / AVAD` |
| **CMI** | ➕ new | — | 25 | **yes** | — | `CMI` |
| **Sonova** | ➕ new | — | 25 | **yes** | — | `Sonova` |
| **Access Communications** | ➕ new | — | 25 | **yes** | — | `Access Communications` |
| **NEC** | ➕ new | — | 24 | **yes** | — | `NEC` |
| **MFB** | ➕ new | — | 24 | **yes** | — | `MFB` |
| **Catchbox** | ➕ new | — | 23 | **yes** | — | `Catchbox` |
| **RS Components** | ➕ new | — | 23 | **yes** | — | `RS Components`; `RS-Online` |
| **Convergent Technologies** | ➕ new | — | 22 | **yes** | — | `Convergent Tech`; `Convergent Technologies` |
| **TouchBoard** | ➕ new | — | 21 | **yes** | — | `TouchBoard` |
| **Podion** | ➕ new | — | 21 | **yes** | — | `Podion` |
| **Blue Gum Joinery** | ➕ new | — | 21 | **yes** | — | `Blue Gum Joinery` |

### Mid-tail (5–19 rows) — 57 suppliers, 594 rows

| Supplier | In live store | Rows | Variants |
|---|---|---:|---|
| WBT | ➕ | 19 | `WBT`; `WBT / Midwich` |
| APS | ➕ | 19 | `APS / Madison / Anixter` |
| The Resource Corp | ➕ | 19 | `The Resource Corp` |
| InTouch Screens | ➕ | 18 | `InTouch Screens` |
| Titan AV | ➕ | 18 | `Titan AV` |
| John Barry | ➕ | 18 | `John Barry / Kayell / Lemac / Videocraft / Videoguys`; `John Barry` |
| APS Industrial | ➕ | 17 | `APS Industrial` |
| Network Devices | ➕ | 16 | `Network Devices` |
| Octopus TV | ➕ | 16 | `Octopus TV` |
| Joan | ➕ | 16 | `Joan` |
| Factory Sound | ➕ | 16 | `Factory Sound` |
| Avico | ➕ | 16 | `Avico / Leading Solutions`; `Avico`; `Avico / Logitech` |
| 4Cabling | ✅ 14 | 15 | `4Cabling` |
| OPIE | ➕ | 15 | `OPIE`; `Opie` |
| Sony | ➕ | 15 | `SONY SPECIAL REQUEST`; `Sony` |
| Octek | ➕ | 14 | `Octek / Ingram` |
| SKS Custom | ➕ | 14 | `SKS Custom - 2.5mm Aluminium Patch Panel - Engraved - 16 Cutout`; `SKS Custom - 2.5mm Aluminium Patch Panel - Engraved - 7 Cutout`; `SKS Custom - 2.5mm Aluminium Patch Panel - Engraved - 78 Cutout` |
| Leading Solutions | ➕ | 13 | `Leading Solutions` |
| CableSafe | ➕ | 13 | `CableSafe / Radio Parts` |
| Swamp Industries | ➕ | 13 | `Swamp Industries`; `Swamp` |
| WhiteboardsRUs | ➕ | 12 | `WhiteboardsRUs` |
| Techbox | ➕ | 12 | `Techbox` |
| AVTEQ | ➕ | 11 | `AVTEQ` |
| Tradezone | ➕ | 11 | `Tradezone / OSA / Madison` |
| BVND | ➕ | 11 | `BVND / CLS`; `BVND` |
| AP Tech | ➕ | 10 | `AP Tech` |
| 1st Class Metals | ➕ | 10 | `1st Class Metals` |
| ASL | ➕ | 10 | `ASL` |
| Audacity | ➕ | 9 | `Audacity` |
| Soundmachine | ➕ | 9 | `Soundmachine` |
| ELB | ➕ | 9 | `ELB` |
| CLS | ➕ | 8 | `CLS` |
| JED | ➕ | 8 | `JED` |
| Assetek | ➕ | 8 | `Assetek` |
| SealTV | ➕ | 8 | `SealTV` |
| AVE | ➕ | 8 | `AVE` |
| CommsPlus | ➕ | 7 | `Comms Plus / Alloys` |
| ULA Group | ➕ | 7 | `ULA Group` |
| Fosh | ➕ | 7 | `Fosh / BTC` |
| AWM | ➕ | 7 | `AWM / Rexel / Middys` |
| JB Hi-Fi | ➕ | 7 | `JB Hi-Fi`; `JB Hi-Fi / Big W`; `JB Hi-Fi / Officeworks` |
| Korbyt | ➕ | 6 | `Korbyt` |
| SOHO Design | ➕ | 6 | `SOHO Design` |
| Video Craft | ➕ | 6 | `Video Craft / Lemac` |
| All Interactive | ➕ | 6 | `All Interactive / Broadcast Bruce` |
| Audio Active | ➕ | 6 | `Audio Active / JB`; `Audio Active`; `Audio Active ONLY` |
| vir2store | ➕ | 5 | `vir2store` |
| TradeZone | ➕ | 5 | `TradeZone / OSA` |
| Lectern Australia | ➕ | 5 | `Lectern Australia` |
| Showtechnix | ➕ | 5 | `Showtechnix / Cases.com.au` |
| Transit Pak | ➕ | 5 | `Transit Pak` |
| Computer Support Systems (CSS) | ➕ | 5 | `Computer Support Systems (CSS)` |
| Leader Access Hire | ➕ | 5 | `Leader Access Hire` |
| Store DJ | ➕ | 5 | `Store DJ` |
| DJ City | ➕ | 5 | `DJ City` |
| AV Supply Group | ➕ | 5 | `AV Supply Group / Madison`; `AV Supply Group` |
| Electus | ➕ | 5 | `Electus / Jaycar`; `Electus (Jaycar / Radio Parts)` |

### Micro-tail (<5 rows) — 40 suppliers, 99 rows

WRE (4), Hearing Aug Australia (4), BTS Australia (4), Braille Co (4), Skedda (4), Caelera (4), SRA Solutions (4), Thor (4), CSR (Himmel Interiors) (4), EECTech (4), SKS (4), XIT (3), OFE (Client Supplied) (3), Autonomic USA (3), Audalize (3), Spacera (3), Xyte (3), Exact Solutions (3), Other World Computing (3), Eshaudio (3), BTC (2), Secure Entertainment (2), CR Kennedy (2), NPS Power (2), Bunnings (2), B&H Online (2), Jaycar (2), Scaff Active (2), L&H (1), Mouser (1), Samsung (1), Capisco (1), Envoy (1), Criterion Industriers (1), Amazon (1), TRC (1), Wyrestorm (1), Wes Components (1), ITE (1), Selby (1)

### Skipped vendor strings

| Vendor string | Rows | Why |
|---|---:|---|
| `DONT ORDER` | 15 | marked do-not-order in the BoM |
| `(blank)` | 15 | no vendor recorded — needs manual assignment |
| `TBC` | 8 | vendor still to be confirmed in the BoM |
| `DON’T ORDER` | 7 | marked do-not-order in the BoM |
| `DONT ORDER / Ingram / ALD` | 4 | marked do-not-order in the BoM |
| `????` | 2 | vendor unknown in the BoM |

### Tab → category mapping

| BoM tab | Rows | → Category |
|---|---:|---|
| Sources | 209 | Video & Displays |
| Signage & IPTV | 319 | Video & Displays |
| LCD Screens | 644 | Video & Displays |
| dvLED Display | 331 | Video & Displays |
| Control | 395 | Control & Automation |
| Projectors | 426 | Video & Displays |
| Mounts | 583 | Racks, Mounts & Structure |
| Audio - Amps | 462 | Audio |
| Audio - Microphones | 696 | Audio |
| Audio - Speakers | 1101 | Audio |
| Audio - DSP | 263 | Audio |
| Hearing Aug | 290 | Audio |
| Room Booking Panels | 240 | Conferencing & Collaboration |
| Cable Rolls (Per Meter) | 288 | Cabling & Connectivity |
| Cables | 853 | Cabling & Connectivity |
| Switching & Distribution | 445 | Video & Displays |
| AVoIP | 277 | Video & Displays |
| Networking | 372 | Networking |
| USB | 172 | Cabling & Connectivity |
| VC | 1012 | Conferencing & Collaboration |
| Broadcast | 301 | Video & Displays |
| Hardware | 819 | Racks, Mounts & Structure |
| Lighting | 31 | Control & Automation |
| Floor Track | 130 | Racks, Mounts & Structure |
| Table Boxes | 190 | Cabling & Connectivity |
| Sound Masking | 166 | Audio |
| TEMP - GCEC Panels & Patch | 14 | ⛔ excluded |
| TEMP - GCEC Cables | 127 | ⛔ excluded |

### Category-mapping flags

- **Signage & IPTV** mixes hardware and CMS licences — licence-ish rows land in
  *Video & Displays* at tab level; `source_category` keeps the section name for
  a later re-shelve into *Software & Licensing* if wanted.
- **Sources** (media players, STBs, OFE PCs) → *Video & Displays* as the least-bad fit.
- **Hardware** tab is genuinely mixed (racks, brackets, misc) → *Racks, Mounts
  & Structure* at tab level; section names preserved.
- **TEMP - GCEC** tabs are project-scratch and excluded entirely.

## 3. Sign-off

- [x] Vendor → supplier mapping approved (incl. decisions 1, 4, 5, 6, 7)
- [x] Category mapping approved (decision 2)
- [x] Skip list approved (decision 3)

Signed off by: Mark Stow ("approve as proposed", in chat)  Date: 20 Jul 2026
