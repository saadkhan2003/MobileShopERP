# Mobile Shop ERP
## User manual and end-to-end UI test guide

**Edition:** Desktop v0.4.3

**Audience:** Shop owner, managers, cashiers, technicians, and UI test team

**Scope:** The installed desktop application on Linux, Windows, or macOS. All test steps use visible controls. No terminal, database editor, API client, or SQL is required.

This guide describes the screens present in the desktop application. Subscription plans and tenant licensing are planned for a later release and are not current tabs. A 30-day sign-in session is not a subscription. Test on a separate test computer or operating-system user account. Never use a live customer's business records for destructive return or restore tests.

# 1. First launch and navigation

1. Open the installed **Mobile Shop ERP** application. On a new installation, create the local owner account using name, username, and a password of at least eight characters.
2. Sign in. The **Dashboard** opens. The sidebar is organized into **Overview**, **Inventory**, **Sales & customers**, **Workshop**, **Finance**, **Management**, and **Help & Documentation**.
3. Use the group chevrons to fold or expand groups. Use **Collapse sidebar** to switch to the icon rail; hover or use the accessible labels to identify icons. Expand it again to see the names.
4. Use **Add new** on pages that support creation. Forms reveal more fields when a category or product is selected. Use **Refresh** to reload a page. Select a row to open its detail card and related actions.
5. Searchable dropdowns filter as you type and should close after an item is selected, when you click outside, or when you press Escape. Date pickers should close when a complete date is chosen. Scroll the content area to reach long forms; the sidebar remains independently scrollable.
6. **Global settings** controls the shop name, tagline, logo, contact details, and receipt footer. The default identity is **Mobile Shop / Desktop ERP** until the owner changes it.

## Roles and access

| Role | Typical access visible in the sidebar |
| --- | --- |
| Owner | Every module, including drawings, branches, settings, backups, and audit trail. |
| Manager | Stock, purchasing, suppliers, reports, staff, and ordinary shop workflows; no owner-only controls. |
| Cashier | Sales, installments, payments, expenses, and cash register, plus shared views. |
| Salesman | Shared views such as dashboard, sales, customers, search, and repair/warranty views. |
| Technician | Shared views, especially repair jobs; financial and manager-only pages are hidden. |

Permissions are checked again when saving. A hidden page should not be treated as proof that an unauthorized action is allowed. Test sign-in and access separately for every role.

# 2. How the modules connect

| Business flow | Start here | Connected screens and records |
| --- | --- | --- |
| Receive new stock | Suppliers -> Products & stock -> Purchases | Accessory quantity rises; each phone gets an IMEI in IMEI stock; price history and reports can reflect changes. |
| Sell stock | Customers -> Sales & invoices | Stock falls; a phone becomes sold; payments, installments, ledger, cash register, dashboard, and reports reflect the sale. |
| Buy a used phone | Customers -> Products & stock -> Used phone buys | Seller payment and a uniquely tracked IMEI appear; the phone can later be sold. |
| Repair a phone | Customers -> Staff -> Repair jobs | Technician assignment, spare-part consumption, customer payment, job card, and cash totals connect. |
| Handle a return | Sales & invoices or Purchases detail | Customer refund or supplier return changes stock, balances, payments, and reports together. |
| Close the day | Cash register -> Reports -> Backup & restore | Counted cash is compared with expected cash; owner verifies an external backup. |
| Investigate a record | Search -> IMEI history -> Audit trail | Find invoice, phone, person, movement, and recorded staff action. |

The desktop stores the shop database locally. Signed releases check for updates on startup and periodically. A normal release shows an update banner; a release marked critical starts installation and blocks shop operations until the signed update is installed. Keep a verified backup before any major upgrade or restore.

# 3. Prepare UI test data

Create these records through the application. Use a unique prefix if several testers share a test database. The values below make later checks easy to calculate.

| Screen | Test record | Values |
| --- | --- | --- |
| Suppliers | QA Parts Supply | Phone 0300-0000001. |
| Customers | QA Buyer and QA Used Seller | Different phone numbers. |
| Staff | QA Technician | Role technician; use a separate test password. |
| Products & stock | QA Phone A | Category phone; SKU QA-PHONE-A; cost Rs 50,000; price Rs 60,000; reorder level 1. |
| Products & stock | QA Charger A | Category charger; SKU QA-CHARGER-A; cost Rs 1,000; price Rs 1,500; reorder level 2. |
| Products & stock | QA Glass A | Category glass; SKU QA-GLASS-A; cost Rs 200; price Rs 500. |
| Products & stock | QA Spare Battery | Category spare_part; SKU QA-PART-A; cost Rs 300; price Rs 700. |

Creating a product defines its catalog record. Use **Purchases** or **Used phone buys** to put sellable stock into inventory. For the first stock receipt, purchase one QA Phone A with IMEI **860000000000001**, ten chargers, ten glasses, and three spare batteries. Use a unique IMEI if that number already exists. Record supplier payment below the purchase total so there is a balance to test later.

Before each test case, write down the starting counts and amounts shown in the UI. For negative tests, use the same test profile and record the exact visible error. Do not load hidden demo data or change the database outside the app.

# 4. Overview modules

## Dashboard

**Use:** Review sales today and this month, receivables, available phones, recent sales, low stock, ready repairs, and overdue installments. The four summary cards open their related modules.

**UI test O-01:** Open Dashboard before test transactions and note the values. Complete a sale, then return to Dashboard and press Refresh. The recent sale and relevant totals should change. Click **Phones available** and confirm it opens IMEI stock. Reduce a product to its reorder level and confirm it appears in Low stock.

**Pass:** Cards show the same business facts as Sales, IMEI stock, Installments, and the stock list. No card leads to an unrelated page.

## Reports

**Use:** Set **From** and **To**, then click **Apply dates**. Review revenue trend, category and stock charts, accessory/phone stock cost, expenses, repair profit, sales, categories, staff, fast stock, slow stock, phone profit, and returns.

**UI test O-02:** Select a range that includes the QA sale and confirm the sale date, category units, and chart appear. Select a range that excludes it and confirm it disappears. Try From after To and confirm an error is shown. Scroll to the bottom; all tables must remain readable without excessive blank space.

**Pass:** Filtering changes transaction charts and tables. Current stock-cost cards are a present-time snapshot and need not change with the date range. Date pickers close after selection.

# 5. Inventory modules

## Products & stock

**Use:** Click **Add new**. Complete Product identity, then choose a category to reveal phone specifications or accessory compatibility. Set cost, selling price, minimum price, reorder level, and warranty days. Select a row to update product pricing or print its barcode/SKU label.

**UI test I-01:** Create the four QA products. Check that the chosen category reveals the correct card and the dropdown closes. Search for each product on Purchases. Select QA Charger A in Products & stock, change its price, and verify a Price history row. Print a label for a product with an ASCII SKU or barcode.

**Pass:** New products are selectable in purchasing and sales. A phone catalog entry alone is not counted as an available handset; a purchase with an IMEI is needed.

## IMEI stock

**Use:** View individually tracked handsets, their product, IMEI 1/2, PTA status, condition, status, cost, and internal ID. The phone purchase and used-phone workflows create these records.

**UI test I-02:** After receiving QA Phone A, find IMEI 860000000000001 and record its internal ID. Sell it once and refresh IMEI stock. Try to select the same IMEI for another sale.

**Pass:** The phone changes from available to sold and no longer appears in the Available IMEI chooser. A duplicate IMEI intake is rejected visibly.

## Purchases

**Use:** Click **Add new**, choose supplier, enter reference/payment, search product by name or scan/type SKU, choose item details, click **Add item** for each line, then **Save purchase**. A phone line requires IMEI details; accessories use quantity. Select a purchase to pay the supplier, inspect lines, or return a line to the supplier.

**UI test I-03:** Receive the sample stock. Verify phone IMEI stock has one available handset, chargers show quantity 10, glasses 10, and spare batteries 3. Select the purchase and use **Pay supplier**. Select a purchase line and use **Return item** with a valid quantity and reason.

**Pass:** The supplier balance and stock change together. A return cannot exceed the received quantity. The purchase remains traceable after payment or return.

## Used phone buys

**Use:** Click **Add new**. Choose a seller from Customers and a phone product, enter a unique IMEI, PTA/condition checklist, included accessories, agreed price, paid amount, and payment method. Select a row to **Pay seller** later.

**UI test I-04:** Buy a used QA Phone A with IMEI 860000000000002 and partial payment. Confirm the phone appears in IMEI stock and IMEI history. Check agreed price and paid amount on the Used phone buys row, then pay the remainder from the selected record. The contact ledger lists the outgoing payment, but its balance card does not include used-phone purchase balances.

**Pass:** The used IMEI is unique and sellable once. Seller payment does not create a second handset.

## Market rates

**Use:** Click **Add new**, choose a product, and record current buy and sell reference rates. These are market references, not a stock receipt or sale.

**UI test I-05:** Add rates for QA Phone A, return to Market rates, and confirm its row. Check that product stock and sale price have not silently changed.

**Pass:** The rate appears with a date and correct product. Stock quantity remains unchanged.

## Price history

**Use:** Review old/new product costs and selling prices with the user who changed them. This page has no Add new action.

**UI test I-06:** Edit QA Charger A cost or price in Products & stock, open Price history, and identify the old/new values and staff member.

**Pass:** A real price edit creates a history row; simply opening the product does not.

# 6. Sales and customers modules

## Sales & invoices

**Use:** Click **Add new**. Choose a customer for credit/instalments, add products by searchable chooser or scanner-style SKU entry, choose an available IMEI for a phone, adjust unit price, add a discount or trade-in, and add split payments. Click **Complete sale**. Select an invoice row to inspect lines, print, save PDF, receive later payment, or record a customer return/refund.

**UI test S-01:** Sell QA Phone A, two QA Charger A units, and one QA Glass A to QA Buyer. Before discount the amount is Rs 63,500; enter Rs 500 discount and payments of Rs 20,000 cash plus Rs 10,000 card. Confirm total Rs 63,000, paid Rs 30,000, and balance Rs 33,000. Save a PDF invoice through the visible save dialog and open the file. Click Print invoice to inspect the print dialog.

**Pass:** Phone status is sold; chargers fall from 10 to 8 and glasses from 10 to 9. The invoice lists lines and IMEI, uses current shop branding, and matches the displayed amounts. Printer hardware must be tested on the actual shop printer.

**UI test S-02:** Select a completed sale and use **Customer return / refund**. Choose a sold line, quantity, refund method, reason, and whether the item returns to sellable stock. Record the return and inspect the return list, stock, customer balance, cash report, and Reports > Returns.

**Pass:** Refund, stock, and balances agree. A fully returned phone must not remain sold and available at the same time. An excessive return is rejected.

## Installments

**Use:** Create a schedule for a customer sale with an unpaid balance. Search **Credit sale**, add each due date and amount, then save only when scheduled total equals the balance. Use **Collect installment** to record payment and **Copy customer reminder** when needed.

**UI test S-03:** For the Rs 33,000 balance from S-01, add two dates for Rs 18,000 and Rs 15,000. Confirm **Save schedule** is unavailable while the amounts do not total Rs 33,000, then save. Pay one installment and refresh Sales, Installments, Ledger, and Dashboard.

**Pass:** The schedule totals the sale balance, payment reduces the installment and receivable, and no second schedule can be created for the same sale.

## Customers

**Use:** Add customer name, phone, address, and notes. Customers appear in sales, used phone intake, repair jobs, and customer ledgers.

**UI test S-04:** Create QA Buyer and QA Used Seller. Search each from the relevant dropdown and confirm only the chosen person is linked to the transaction.

**Pass:** Contact details persist after navigating away and back. Duplicate test names should be avoided because dropdown selection would be ambiguous.

## Customer & supplier ledger

**Use:** Choose Customer or Supplier, search a contact, and click **View ledger**. Review outstanding balance, transactions, and payments.

**UI test S-05:** Open QA Buyer after S-01; check the sale and later installment payment. Switch the ledger type to Supplier and choose QA Parts Supply; the previous customer result should clear before the supplier result loads.

**Pass:** Customer and supplier balances are separate, and switching contacts never shows stale data from the prior contact.

## Payments

**Use:** View payment records. Click **Add new** to enter a Sale ID, Purchase ID, or Repair ID, amount, method, and notes. For a sale or purchase, the selected record's detail card also provides Receive payment or Pay supplier. Internal IDs are visible in the relevant lists.

**UI test S-06:** Record a small valid payment against an outstanding test sale or purchase. Refresh that record and its ledger. Try an amount greater than the outstanding balance.

**Pass:** A valid payment appears once and reduces the correct balance. An overpayment or unrelated ID is rejected. Cash-method payments affect the cash report appropriately.

# 7. Workshop modules

## Repair jobs

**Use:** Add a job for an existing customer with model, optional IMEI, fault, condition notes, received accessories, expected date, technician, labor charge, and other cost. Select the job to update its status, assign technician, consume spare parts, save a PDF job card, or copy a ready-for-pickup message when status is Ready.

**UI test W-01:** Create a job for QA Buyer and QA Technician. Move Received -> Checking -> Waiting for Part -> In Repair -> Ready -> Delivered as the work progresses. Consume one QA Spare Battery and verify its stock falls from 3 to 2. Save and open the job-card PDF; when Ready, use Copy ready message.

**Pass:** Job number, customer, fault, costs, technician, status, and part movement remain linked. A part cannot be consumed beyond stock. The copied message contains the job number.

## Warranty claims

**Use:** Add a claim using the numeric Sale ID shown in Sales & invoices. Phone ID is optional and can be read from IMEI stock. Enter issue/action, then select a claim to set open, approved, rejected, or resolved with action/result.

**UI test W-02:** Create a claim for the QA phone sale, using its visible Sale ID and Phone ID. Update the claim to approved and then resolved. Open IMEI history for the phone.

**Pass:** The claim links to the correct invoice/IMEI, shows expiry and status, and appears in the phone's history. An invalid Sale ID is rejected.

# 8. Finance modules

## Suppliers

**Use:** Add vendor name, phone, address, and notes. Suppliers appear in Purchases and supplier ledgers.

**UI test F-01:** Create QA Parts Supply, use it on a purchase, and then view its ledger after partial payment and a supplier return.

**Pass:** Purchase and payment entries appear under the same supplier.

## Expenses

**Use:** Click **Add new** and record category, description, amount, and payment method.

**UI test F-02:** Record a test cash expense with a distinctive category. Review Reports and the active Cash register daily closing report.

**Pass:** The expense is listed once and the cash expected value changes if paid in cash.

## Owner drawings

**Use:** The owner records shop cash withdrawn for personal use, with amount and note.

**UI test F-03:** Sign in as owner and add one test drawing during an open cash session. Sign in as cashier and verify the owner-only module is unavailable. Inspect the daily closing report.

**Pass:** Drawing is listed and reduces expected cash without being mislabeled as an operating expense.

## Cash register

**Use:** Enter opening cash and click **Open session**. At close, count physical cash, enter Actual closing cash, and click **Close session**. Select a cash session and **Load report** for opening cash, money in/out, expenses, drawings, expected cash, counted cash, difference, payments by method, and refunds.

**UI test F-04:** Open with Rs 5,000, perform a cash sale/payment, cash expense, and drawing. Load the report before closing, calculate expected cash from visible entries, then close with a counted amount deliberately Rs 100 different in the test profile.

**Pass:** Difference shows Rs 100 with the correct sign, and the closed session remains available for review. Do not use deliberate discrepancies on the live client's register.

# 9. Management modules

## IMEI history

**Use:** Enter an exact IMEI to inspect phone details, sale, warranty, repair references, and stock movements.

**UI test M-01:** Search the purchased QA phone IMEI before and after sale, and after a warranty claim or return. Compare the recorded sequence with the other modules.

**Pass:** The history follows one physical phone and never silently changes its IMEI.

## Search

**Use:** Search product, IMEI, customer, or invoice. Results are grouped into products, phones, sales, and contacts.

**UI test M-02:** Search QA-CHARGER-A, the test IMEI, QA Buyer, and the saved invoice number in separate searches.

**Pass:** Each query returns the expected group and does not show stale results from the previous query.

## Staff

**Use:** An owner creates local accounts with manager, cashier, salesman, or technician role. Managers can view the staff list; account creation is owner controlled.

**UI test M-03:** Create QA Technician and one cashier. Sign out and sign in as each role. Confirm visible modules, ability to open authorized pages, and rejection of restricted actions.

**Pass:** Technician can be chosen for a repair. Cashier cannot reach owner-only Global settings, Backup & restore, Audit trail, or Owner drawings.

## Branches

**Use:** The owner records shop locations with name, address, and phone. The current desktop app has local branch records; it is not a cloud multi-branch synchronization service.

**UI test M-04:** Add a second test branch and confirm it persists after Refresh and sign-in. Check that ordinary staff cannot open this owner-only page.

**Pass:** Branch data appears in the list without changing existing transactions.

## Global settings

**Use:** Change shop name, tagline, logo (PNG/JPEG/WebP under 1 MB), shop phone, address, and receipt footer. The live preview shows sidebar and receipt identity. The Signed updates card allows a manual check; available normal releases also show a banner above every page.

**UI test M-05:** Change the name and footer, upload a valid logo, and click **Save settings**. Check the sidebar and a newly saved invoice PDF. Try an oversized or wrong-format image and confirm a visible error. Remove the logo and save again.

**Pass:** Branding persists after relaunch and appears on new documents. Invalid images are refused without removing the saved logo.

## Backup & restore

**Use:** Create a local backup, select an external folder on another drive, enable scheduled copies, set interval, save schedule, copy now, verify a file, and review restore before confirming. Restore creates a safety copy before replacing the database.

**UI test M-06:** In an isolated test profile, create a local backup and verify it. Choose a removable/test folder, enable scheduled copies, click Copy to destination now, and verify the external file. Add a clearly disposable test record, use **Review restore**, read the warning, then **Confirm restore** from the earlier verified backup.

**Pass:** The disposable record disappears after restore, earlier data returns, and a safety snapshot is listed. If a backup is missing or corrupt, restore must fail visibly. Never perform this test on a production database.

## Audit trail

**Use:** Owner-only chronological record of staff actions with date, user, action, entity, record ID, and details.

**UI test M-07:** Perform a product edit, sale return, settings change, and backup action as authorized users; refresh Audit trail.

**Pass:** The listed actor, operation, and record type match the visible action. Cashier/technician must not see this page.

# 10. Help and documentation

## User Guide & Documentation

**Use:** Open the **Help & Documentation** sidebar group, then **User Guide & Documentation**. Browse the built-in guide, search for a feature, and use its links to open the related module. The installed help page is a quick reference; this PDF provides the full UI test procedure.

**UI test H-01:** Search the help page for inventory, billing, repair, and backup. Open one matching module link from each topic, then return to the guide. Verify the guide remains readable with the sidebar expanded and collapsed.

**Pass:** Search results match the query, each link opens the intended module, and there is no blank or broken help panel.

# 11. UI-only regression checklist

Run the following after every release. Mark each **Pass**, **Fail**, or **Not run** and attach a screenshot for failures. Do not substitute command-line or database checks for the on-screen result.

| ID | UI action | Expected visible result |
| --- | --- | --- |
| R-01 | Sign in, sign out, and relaunch. | Correct account, no stale signed-in session after sign-out. |
| R-02 | Collapse sidebar, navigate by icon, expand, relaunch. | Selected page and saved collapse preference work. |
| R-03 | Open each sidebar group and all 27 module pages as owner. | Correct heading and no error or blank crash screen. |
| R-04 | Search a dropdown, select a value, click outside, press Escape. | List closes; chosen value stays selected. |
| R-05 | Choose dates in Reports, Repairs, and Installments. | Date picker closes and date remains correct. |
| R-06 | Scroll long Reports and form pages to the bottom. | Content remains readable; no huge empty tail or overlapping navigation. |
| R-07 | Scan/type a known SKU in Purchases and Sales, then press Enter/Find. | Correct product is selected; wrong SKU does not select another item. |
| R-08 | Attempt duplicate IMEI, oversell accessory, and overpay balance. | Visible rejection; original data remains unchanged. |
| R-09 | Save invoice PDF and repair job card via native dialog. | Chosen PDF opens and has correct details and branding. |
| R-10 | Open print dialog for invoice and product label. | Preview appears; test physical printer only where connected. |
| R-11 | Record sale, split payment, installment, return, and repair part. | Linked screens and dashboard/reports stay consistent. |
| R-12 | Verify backup, create external copy, restore only in test profile. | Verified copy and restored records match the chosen snapshot. |
| R-13 | Sign in as owner, manager, cashier, salesman, technician. | Sidebar and save permissions match the role. |
| R-14 | Install an older signed build via its normal installer and check for a newer release through the UI. | Banner or Settings offers the correct update; signed installation completes and version advances. |
| R-15 | For a release designated critical by the release manager, launch the older signed build. | Required update screen blocks shop use; Retry remains available if download fails. |

R-14 and R-15 require the release manager to provide two real signed installers. Testers perform the install and update through the operating-system installer and app controls only. Mark them **Not run** when no older build or critical release is available; do not claim a pass from a component test.

# 12. Failure report and sign-off

For every failure, capture: test ID, app version shown in the release/installer, operating system, signed-in role, screen name, exact clicks/entries, expected result, actual result, screenshot, whether it repeats, and whether the test profile can be restored from backup. Use test customer data only.

| Sign-off field | Entry |
| --- | --- |
| Test computer / operating system | ______________________________ |
| App version / installer type | ______________________________ |
| Test profile and date | ______________________________ |
| Cases passed / failed / not run | ______________________________ |
| Physical printer and scanner checked? | ______________________________ |
| External backup verified? | ______________________________ |
| Blocking defects and evidence location | ______________________________ |
| Tester name / reviewer / date | ______________________________ |

The signed desktop update and local database are separate concerns. A successful update does not prove a restore works; a successful backup does not prove a printer works. Complete the related UI cases before declaring the shop ready for daily use.
