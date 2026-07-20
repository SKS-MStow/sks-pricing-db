BEGIN;
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 40 FROM quotes.suppliers s WHERE s.code = 'ALLOYS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'ALTRONICS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'AMBERTECHNOLOGY'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'APPSPACE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'APSINDUSTRIALCABLE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'AUDIOLOGISTICS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'AURORASIGNAGE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'AUROZ'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'AUSTRALIS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'AVAD'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'AVDAUDIOVISUALDISTRIBUTO'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'BARCOLCD'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'BELDEN'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'BLUEGUMJOINERY'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'BLUSTREAM'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'CANOHM'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'CATCHBOXINEUROS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 40 FROM quotes.suppliers s WHERE s.code = 'CISCO'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'CMSELECTRACOM'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'COMMSPLUSDISTRIBUTIONBTC'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'CORSAIR'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 40 FROM quotes.suppliers s WHERE s.code = 'DICKERDATACOMBINEPRICLIS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'ECD'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'ELGEE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'GROUPTECHNOLOGIES'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'HISENSE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'HPEARUBAENTERPRISENETWOR'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 40 FROM quotes.suppliers s WHERE s.code = 'INGRAMMICRO'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'KORDZ'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'LEADERSYSTEMSALLOY'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'LECTERNAUSTRALIA'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'LG'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'LIGHTWARE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'LOGITECH'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 40 FROM quotes.suppliers s WHERE s.code = 'MIDWICH'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'MMT'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'OCTEKZOTAC'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'OPIEWILSONGILKES'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'PAVTPRODUCTIONAUDIOVIDEO'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'PODION'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'QUANTUMSPHERE'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'SAMSUNG'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'SCREENTECHNICS'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'SEKTOR'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'SELTEC'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'SENNHEISER'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'SMARTSIGN'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 40 FROM quotes.suppliers s WHERE s.code = 'SYNNEX'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'TCL'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'UNIGESTTRIPLEPLAY'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 380 FROM quotes.suppliers s WHERE s.code = 'VITECEXTERITY'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'WESTAN'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'WORLDSBESTTECHNOLOGYWBT'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
INSERT INTO quotes.pricelist_scan_config (supplier_id, scope_label, stale_days)
SELECT s.id, NULL, 100 FROM quotes.suppliers s WHERE s.code = 'YEALINK'
  AND NOT EXISTS (SELECT 1 FROM quotes.pricelist_scan_config c WHERE c.supplier_id = s.id AND COALESCE(c.scope_label,'') = '');
COMMIT;
