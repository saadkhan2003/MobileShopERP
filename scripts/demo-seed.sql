-- Repeatable demonstration data for a freshly configured Mobile Shop ERP.
-- This inserts records only when their DEMO identifier is absent.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

INSERT INTO branches(name,address,phone)
SELECT 'Demo Mall Branch','Shop 12, Main Mall','0300-0000012'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name='Demo Mall Branch');

INSERT INTO contacts(kind,name,phone,address,notes)
SELECT 'supplier','DEMO Tech Distributors','0300-1000001','Hall Road, Lahore','Demo supplier'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind='supplier' AND name='DEMO Tech Distributors');
INSERT INTO contacts(kind,name,phone,address,notes)
SELECT 'supplier','DEMO Parts Hub','0300-1000002','Saddar, Rawalpindi','Demo repair parts vendor'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind='supplier' AND name='DEMO Parts Hub');
INSERT INTO contacts(kind,name,phone,address,notes)
SELECT 'customer','DEMO Ayesha Malik','0300-2000001','Lahore','Installment customer'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind='customer' AND name='DEMO Ayesha Malik');
INSERT INTO contacts(kind,name,phone,address,notes)
SELECT 'customer','DEMO Bilal Khan','0300-2000002','Lahore','Repair customer'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind='customer' AND name='DEMO Bilal Khan');
INSERT INTO contacts(kind,name,phone,address,notes)
SELECT 'customer','DEMO Hamza Ali','0300-2000003','Lahore','Used phone seller'
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE kind='customer' AND name='DEMO Hamza Ali');

INSERT OR IGNORE INTO products(sku,barcode,name,category,brand,model,variant,color,storage,condition,compatible_models,cost,price,min_price,quantity,reorder_level,warranty_days)
VALUES
('DEMO-PH-A55','8900000000001','DEMO Samsung Galaxy A55 8/256','phone','Samsung','Galaxy A55','8/256','Navy','256GB','box_pack','',70000,85000,80000,0,0,365),
('DEMO-PH-IP13','8900000000002','DEMO iPhone 13 128GB Used','phone','Apple','iPhone 13','128GB','Midnight','128GB','used','',45000,59000,52000,0,0,30),
('DEMO-CH-USBC','8900000000003','DEMO 25W USB-C Charger','charger','Baseus','25W','EU plug','White','','new','Galaxy A55, Galaxy S23',1200,1800,1500,10,4,30),
('DEMO-GL-A55','8900000000004','DEMO A55 Tempered Glass','glass','Generic','A55','','Clear','','new','Samsung Galaxy A55',250,600,450,19,5,7),
('DEMO-CB-C','8900000000005','DEMO USB-C Cable 1m','cable','Baseus','1m','','Black','','new','USB-C phones',300,700,500,14,5,30),
('DEMO-SP-BAT','8900000000006','DEMO A55 Replacement Battery','spare_part','Generic','A55','','','','new','Samsung Galaxy A55',1800,3000,2500,7,2,30);

INSERT INTO purchases(supplier_id,reference,total,paid,payment_method,notes,branch_id,created_by)
SELECT (SELECT id FROM contacts WHERE name='DEMO Tech Distributors'),
       'DEMO-PO-001',178000,100000,'bank_transfer','Demo mixed phone and accessory purchase',1,
       (SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM purchases WHERE reference='DEMO-PO-001');

INSERT OR IGNORE INTO phones(product_id,imei1,imei2,pta_status,condition_grade,checklist,box_included,charger_included,purchase_cost,supplier_id,status,sale_id,notes)
VALUES
((SELECT id FROM products WHERE sku='DEMO-PH-A55'),'900000000000001','900000000000011','approved','A','{"screen":"pass","battery":"pass","camera":"pass"}',1,1,70000,(SELECT id FROM contacts WHERE name='DEMO Tech Distributors'),'sold',(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),'Demo sold handset'),
((SELECT id FROM products WHERE sku='DEMO-PH-A55'),'900000000000002','900000000000012','approved','A','{"screen":"pass","battery":"pass","camera":"pass"}',1,1,70000,(SELECT id FROM contacts WHERE name='DEMO Tech Distributors'),'available',NULL,'Demo available handset'),
((SELECT id FROM products WHERE sku='DEMO-PH-IP13'),'900000000000003',NULL,'unknown','B','{"screen":"minor scratches","battery":"86%","camera":"pass"}',0,0,45000,NULL,'available',NULL,'Demo used phone');

INSERT INTO purchase_lines(purchase_id,product_id,phone_id,quantity,unit_cost)
SELECT (SELECT id FROM purchases WHERE reference='DEMO-PO-001'),p.id,h.id,1,70000
FROM phones h JOIN products p ON p.id=h.product_id
WHERE h.imei1 IN ('900000000000001','900000000000002')
  AND NOT EXISTS (SELECT 1 FROM purchase_lines l WHERE l.phone_id=h.id);
INSERT INTO purchase_lines(purchase_id,product_id,quantity,unit_cost)
SELECT (SELECT id FROM purchases WHERE reference='DEMO-PO-001'),p.id,
       CASE p.sku WHEN 'DEMO-CH-USBC' THEN 12 WHEN 'DEMO-GL-A55' THEN 20 WHEN 'DEMO-CB-C' THEN 15 ELSE 8 END,
       p.cost
FROM products p WHERE p.sku IN ('DEMO-CH-USBC','DEMO-GL-A55','DEMO-CB-C','DEMO-SP-BAT')
  AND NOT EXISTS (SELECT 1 FROM purchase_lines l WHERE l.purchase_id=(SELECT id FROM purchases WHERE reference='DEMO-PO-001') AND l.product_id=p.id);

INSERT INTO used_purchases(customer_id,phone_id,agreed_price,paid,testing_notes,branch_id,created_by)
SELECT (SELECT id FROM contacts WHERE name='DEMO Hamza Ali'),(SELECT id FROM phones WHERE imei1='900000000000003'),45000,30000,'Screen light scratches; battery 86%',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM used_purchases WHERE phone_id=(SELECT id FROM phones WHERE imei1='900000000000003'));

INSERT OR IGNORE INTO sales(invoice_no,customer_id,subtotal,discount,total,paid,status,notes,branch_id,created_by)
VALUES('INV-DEMO-001',(SELECT id FROM contacts WHERE name='DEMO Ayesha Malik'),89200,2000,87200,40000,'completed','Demo phone plus charger and glass',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1));
UPDATE phones SET status='sold',sale_id=(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001') WHERE imei1='900000000000001';

INSERT INTO sale_lines(sale_id,product_id,phone_id,description,quantity,unit_price,unit_cost,warranty_days)
SELECT s.id,p.id,h.id,p.name,1,85000,70000,365 FROM sales s, products p, phones h
WHERE s.invoice_no='INV-DEMO-001' AND p.sku='DEMO-PH-A55' AND h.imei1='900000000000001'
AND NOT EXISTS (SELECT 1 FROM sale_lines l WHERE l.sale_id=s.id AND l.phone_id=h.id);
INSERT INTO sale_lines(sale_id,product_id,description,quantity,unit_price,unit_cost,warranty_days)
SELECT s.id,p.id,p.name,CASE p.sku WHEN 'DEMO-CH-USBC' THEN 2 ELSE 1 END,p.price,p.cost,p.warranty_days
FROM sales s, products p WHERE s.invoice_no='INV-DEMO-001' AND p.sku IN ('DEMO-CH-USBC','DEMO-GL-A55')
AND NOT EXISTS (SELECT 1 FROM sale_lines l WHERE l.sale_id=s.id AND l.product_id=p.id);

INSERT INTO installments(sale_id,due_date,amount,paid)
SELECT (SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),'2026-10-01',23600,0
WHERE NOT EXISTS (SELECT 1 FROM installments WHERE sale_id=(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001') AND due_date='2026-10-01');
INSERT INTO installments(sale_id,due_date,amount,paid)
SELECT (SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),'2026-11-01',23600,0
WHERE NOT EXISTS (SELECT 1 FROM installments WHERE sale_id=(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001') AND due_date='2026-11-01');

INSERT OR IGNORE INTO repairs(job_no,customer_id,model,imei,fault,condition_notes,received_accessories,expected_date,status,labor_charge,parts_cost,other_cost,paid,branch_id,created_by)
VALUES('JOB-DEMO-001',(SELECT id FROM contacts WHERE name='DEMO Bilal Khan'),'Samsung Galaxy A55','900000000000004','Battery drains quickly','Good body','Phone only','2026-09-28','Ready',2500,1800,0,2000,1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1));
INSERT INTO repair_parts(repair_id,product_id,quantity,unit_cost)
SELECT (SELECT id FROM repairs WHERE job_no='JOB-DEMO-001'),(SELECT id FROM products WHERE sku='DEMO-SP-BAT'),1,1800
WHERE NOT EXISTS (SELECT 1 FROM repair_parts WHERE repair_id=(SELECT id FROM repairs WHERE job_no='JOB-DEMO-001'));

INSERT INTO warranty_claims(sale_id,phone_id,issue,action,result,status,created_by)
SELECT (SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),(SELECT id FROM phones WHERE imei1='900000000000001'),'Battery check requested','Inspection booked','','open',(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM warranty_claims WHERE issue='Battery check requested' AND sale_id=(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'));

INSERT INTO purchase_returns(purchase_line_id,quantity,refund,reason,created_by)
SELECT (SELECT l.id FROM purchase_lines l JOIN products p ON p.id=l.product_id WHERE p.sku='DEMO-CB-C' AND l.purchase_id=(SELECT id FROM purchases WHERE reference='DEMO-PO-001')),1,300,'Demo defective cable',(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM purchase_returns WHERE reason='Demo defective cable');

INSERT INTO payments(direction,contact_id,sale_id,purchase_id,repair_id,method,amount,notes,branch_id,created_by)
SELECT 'out',(SELECT id FROM contacts WHERE name='DEMO Tech Distributors'),NULL,(SELECT id FROM purchases WHERE reference='DEMO-PO-001'),NULL,'bank_transfer',100000,'Demo purchase payment',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE notes='Demo purchase payment');
INSERT INTO payments(direction,contact_id,sale_id,purchase_id,repair_id,method,amount,notes,branch_id,created_by)
SELECT 'in',(SELECT id FROM contacts WHERE name='DEMO Ayesha Malik'),(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),NULL,NULL,'cash',20000,'Demo sale cash',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE notes='Demo sale cash');
INSERT INTO payments(direction,contact_id,sale_id,purchase_id,repair_id,method,amount,notes,branch_id,created_by)
SELECT 'in',(SELECT id FROM contacts WHERE name='DEMO Ayesha Malik'),(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),NULL,NULL,'bank_transfer',20000,'Demo sale bank',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE notes='Demo sale bank');
INSERT INTO payments(direction,contact_id,sale_id,purchase_id,repair_id,method,amount,notes,branch_id,created_by)
SELECT 'out',(SELECT id FROM contacts WHERE name='DEMO Hamza Ali'),NULL,NULL,NULL,'bank_transfer',30000,'Demo used phone payment',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE notes='Demo used phone payment');
INSERT INTO payments(direction,contact_id,sale_id,purchase_id,repair_id,method,amount,notes,branch_id,created_by)
SELECT 'in',(SELECT id FROM contacts WHERE name='DEMO Bilal Khan'),NULL,NULL,(SELECT id FROM repairs WHERE job_no='JOB-DEMO-001'),'cash',2000,'Demo repair payment',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE notes='Demo repair payment');

INSERT INTO expenses(category,description,amount,method,branch_id,created_by)
SELECT 'rent','DEMO September shop rent',15000,'bank_transfer',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE description='DEMO September shop rent');
INSERT INTO drawings(amount,notes,branch_id,created_by)
SELECT 3000,'DEMO owner cash drawing',1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM drawings WHERE notes='DEMO owner cash drawing');
INSERT INTO cash_sessions(opening,expected_closing,actual_closing,closed_at,branch_id,opened_by)
SELECT 10000,29000,29000,CURRENT_TIMESTAMP,1,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM cash_sessions WHERE opening=10000 AND actual_closing=29000 AND opened_by=(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1));
INSERT INTO market_rates(product_id,buy_rate,sell_rate,user_id)
SELECT (SELECT id FROM products WHERE sku='DEMO-PH-A55'),69000,83000,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM market_rates WHERE product_id=(SELECT id FROM products WHERE sku='DEMO-PH-A55'));
INSERT INTO price_history(product_id,old_cost,new_cost,old_price,new_price,changed_by)
SELECT (SELECT id FROM products WHERE sku='DEMO-PH-A55'),68000,70000,83000,85000,(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM price_history WHERE product_id=(SELECT id FROM products WHERE sku='DEMO-PH-A55'));

INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id)
SELECT h.product_id,h.id,1,'purchase',(SELECT id FROM purchases WHERE reference='DEMO-PO-001'),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM phones h WHERE h.imei1 IN ('900000000000001','900000000000002')
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.phone_id=h.id AND m.reason='purchase');
INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id)
SELECT h.product_id,h.id,1,'used_purchase',(SELECT id FROM used_purchases WHERE phone_id=h.id),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM phones h WHERE h.imei1='900000000000003'
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.phone_id=h.id AND m.reason='used_purchase');
INSERT INTO stock_movements(product_id,phone_id,delta,reason,reference_id,user_id)
SELECT h.product_id,h.id,-1,'sale',(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM phones h WHERE h.imei1='900000000000001'
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.phone_id=h.id AND m.reason='sale');
INSERT INTO stock_movements(product_id,delta,reason,reference_id,user_id)
SELECT p.id,CASE p.sku WHEN 'DEMO-CH-USBC' THEN 12 WHEN 'DEMO-GL-A55' THEN 20 WHEN 'DEMO-CB-C' THEN 15 ELSE 8 END,'purchase',(SELECT id FROM purchases WHERE reference='DEMO-PO-001'),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM products p WHERE p.sku IN ('DEMO-CH-USBC','DEMO-GL-A55','DEMO-CB-C','DEMO-SP-BAT')
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id=p.id AND m.reason='purchase');
INSERT INTO stock_movements(product_id,delta,reason,reference_id,user_id)
SELECT p.id,CASE p.sku WHEN 'DEMO-CH-USBC' THEN -2 ELSE -1 END,'sale',(SELECT id FROM sales WHERE invoice_no='INV-DEMO-001'),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM products p WHERE p.sku IN ('DEMO-CH-USBC','DEMO-GL-A55')
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id=p.id AND m.reason='sale');
INSERT INTO stock_movements(product_id,delta,reason,reference_id,user_id)
SELECT p.id,-1,'purchase_return',(SELECT id FROM purchase_returns WHERE reason='Demo defective cable'),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM products p WHERE p.sku='DEMO-CB-C'
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id=p.id AND m.reason='purchase_return');
INSERT INTO stock_movements(product_id,delta,reason,reference_id,user_id)
SELECT p.id,-1,'repair',(SELECT id FROM repairs WHERE job_no='JOB-DEMO-001'),(SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1)
FROM products p WHERE p.sku='DEMO-SP-BAT'
AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id=p.id AND m.reason='repair');

INSERT INTO audit(user_id,action,entity,entity_id,details)
SELECT (SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1),'seed','demo',NULL,'{"fixture":"demo-seed.sql"}'
WHERE NOT EXISTS (SELECT 1 FROM audit WHERE action='seed' AND entity='demo');
COMMIT;
