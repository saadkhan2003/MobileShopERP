-- Read-only verification of the demo fixture; each row should say PASS.
SELECT 'fixture_present' AS check_name, CASE WHEN
 (SELECT COUNT(*) FROM products WHERE sku LIKE 'DEMO-%')=6 AND
 (SELECT COUNT(*) FROM phones WHERE imei1 IN ('900000000000001','900000000000002','900000000000003'))=3 AND
 (SELECT COUNT(*) FROM sales WHERE invoice_no='INV-DEMO-001')=1
 THEN 'PASS' ELSE 'FAIL' END AS result;
SELECT 'integrity' AS check_name, CASE WHEN (SELECT integrity_check FROM pragma_integrity_check)='ok' THEN 'PASS' ELSE 'FAIL' END AS result;
SELECT 'foreign_keys' AS check_name, CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 'PASS' ELSE 'FAIL' END AS result;
SELECT 'accessory_stock' AS check_name, CASE WHEN NOT EXISTS (
 SELECT 1 FROM products p WHERE p.sku LIKE 'DEMO-%' AND p.category!='phone'
 AND p.quantity != COALESCE((SELECT SUM(m.delta) FROM stock_movements m WHERE m.product_id=p.id AND m.phone_id IS NULL),0)
) THEN 'PASS' ELSE 'FAIL' END AS result;
SELECT 'purchase_total' AS check_name, CASE WHEN NOT EXISTS (
 SELECT 1 FROM purchases p WHERE p.reference='DEMO-PO-001' AND ABS(p.total - (
  (SELECT SUM(l.quantity*l.unit_cost) FROM purchase_lines l WHERE l.purchase_id=p.id) -
  (SELECT COALESCE(SUM(r.refund),0) FROM purchase_returns r JOIN purchase_lines l ON l.id=r.purchase_line_id WHERE l.purchase_id=p.id)
 ))>0.01
) THEN 'PASS' ELSE 'FAIL' END AS result;
SELECT 'sale_totals' AS check_name, CASE WHEN NOT EXISTS (
 SELECT 1 FROM sales s WHERE s.invoice_no='INV-DEMO-001' AND (
 ABS(s.subtotal-(SELECT SUM(l.quantity*l.unit_price) FROM sale_lines l WHERE l.sale_id=s.id))>0.01 OR
 ABS(s.total-(s.subtotal-s.discount-s.trade_in_value))>0.01 OR
 ABS(s.paid-(SELECT SUM(p.amount) FROM payments p WHERE p.sale_id=s.id))>0.01 OR
 ABS((s.total-s.paid)-(SELECT SUM(i.amount-i.paid) FROM installments i WHERE i.sale_id=s.id))>0.01)
) THEN 'PASS' ELSE 'FAIL' END AS result;
SELECT 'repair_costs' AS check_name, CASE WHEN NOT EXISTS (
 SELECT 1 FROM repairs r WHERE r.job_no='JOB-DEMO-001' AND (
 ABS(r.parts_cost-(SELECT SUM(p.quantity*p.unit_cost) FROM repair_parts p WHERE p.repair_id=r.id))>0.01 OR
 ABS(r.paid-(SELECT SUM(p.amount) FROM payments p WHERE p.repair_id=r.id))>0.01)
) THEN 'PASS' ELSE 'FAIL' END AS result;
