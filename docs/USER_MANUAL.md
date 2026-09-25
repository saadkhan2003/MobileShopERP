# Mobile Shop Desktop ERP — User Manual & Operations Guide
**Version:** 0.4.0  
**Edition:** Enterprise Desktop (Offline-First)  
**Author:** Stack and Scale / Muhammad Saad Khan  
**Last Updated:** September 2026  

---

## Table of Contents
1. [Introduction & Overview](#1-introduction--overview)
2. [System Architecture & Security](#2-system-architecture--security)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [First-Time Setup & Store Configuration](#4-first-time-setup--store-configuration)
5. [Cash Register & Shift Management](#5-cash-register--shift-management)
6. [Inventory & Stock Management](#6-inventory--stock-management)
   - 6.1 Box-Packed (New) Mobile Phones & IMEI Intake
   - 6.2 Used / Second-Hand Mobile Phone Purchases (CNIC Verification)
   - 6.3 Spare Parts Management
   - 6.4 Accessories & General Products
   - 6.5 Barcode Generation & Printing
7. [Point of Sale (POS) & Billing](#7-point-of-sale-pos--billing)
   - 7.1 Scanning & Selecting Items
   - 7.2 Discounts & Price Adjustments
   - 7.3 Multi-Payment Modes (Cash, Card, Bank, Credit / Khata)
   - 7.4 Thermal Receipts (80mm) & Standard Invoices
8. [Customer & Supplier Ledgers (Khata Accounts)](#8-customer--supplier-ledgers-khata-accounts)
   - 8.1 Customer Credit (Udhaar) Management
   - 8.2 Customer Balance Settlements
   - 8.3 Supplier & Seller Ledger Balances
9. [Mobile Repair & Service Center Workflow](#9-mobile-repair--service-center-workflow)
   - 9.1 Receiving Faulty Devices & Job Card Intake
   - 9.2 Generating & Printing Job Card Receipts
   - 9.3 Assigning Technicians & Status Updates
   - 9.4 Consuming Spare Parts into Repairs
   - 9.5 Final Repair Billing, Delivery & Deposit Settlement
10. [Returns, Replacements & IMEI Lifecycle Search](#10-returns-replacements--imei-lifecycle-search)
    - 10.1 Processing Customer Returns
    - 10.2 Full IMEI Lifecycle History Inspection
11. [Expenses & Owner Drawings](#11-expenses--owner-drawings)
    - 11.1 Recording Daily Shop Expenses
    - 11.2 Owner Drawings & Capital Injections
12. [Business Reports & Analytics](#12-business-reports--analytics)
13. [Database Backups, Restore & Maintenance](#13-database-backups-restore--maintenance)
    - 13.1 Daily One-Click Backups
    - 13.2 Database Restore Procedure
    - 13.3 Audit Trail & Security Logs
    - 13.4 Automatic Software Updates
14. [Frequently Asked Questions (FAQ) & Troubleshooting](#14-frequently-asked-questions-faq--troubleshooting)

---

## 1. Introduction & Overview

Welcome to **Mobile Shop Desktop ERP**, an enterprise-grade, offline-first management system designed specifically for retail mobile phone stores, wholesale distributors, and mobile repair centers.

### Key Capabilities:
- **Offline-First Independence:** Operates 100% locally on your desktop computer without requiring a continuous internet connection. Internet is only used for checking signed software updates.
- **Dual Inventory Tracks:** Distinct, optimized workflows for serialized box-packed phones (IMEIs), used phones with seller ID/CNIC documentation, repair spare parts, and general retail accessories.
- **Integrated Repair Service Center:** Comprehensive Job Card ticketing with physical condition checklists, advance deposits, spare parts consumption, and technician tracking.
- **Built-in Credit Ledger (Khata):** Full double-entry customer credit and supplier payment ledger tracking outstanding balances, partial payments, and payment histories.
- **Daily Cash Register Control:** Strict shift sessions requiring morning opening balance, mid-day cash in/out logging, and end-of-day closing reconciliation to eliminate cash drawer discrepancies.
- **Hardware Integration:** Native support for USB barcode scanners, 80mm thermal receipt printers, and standard desktop A4/Letter laser/inkjet printers.

---

## 2. System Architecture & Security

- **Core Engine:** Built on Rust and Tauri v2 for ultra-fast performance, low RAM consumption, and rock-solid system stability.
- **Local Database:** High-performance, embedded SQLite database located securely in the local application storage directory.
- **Timezone Awareness:** All records are stored with ISO UTC timestamps and automatically displayed in local time (PKT / UTC+05:00).
- **Data Privacy:** Your business data, financial records, customer records, and inventory remain strictly on your premises.

---

## 3. User Roles & Permissions

Mobile Shop Desktop ERP utilizes Role-Based Access Control (RBAC) to ensure staff members only access operations appropriate to their duties:

| Role | Cash Register | POS Sales | Repair Intake | Inventory Edits | Financial Reports | Settings & Backups |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Admin** | Full | Full | Full | Full | Full | Full |
| **Manager** | Full | Full | Full | Full | Full | View Only |
| **Cashier** | Own Session | Full | View / Receive | View Only | Limited / Shift | None |
| **Technician**| None | None | Job Cards & Parts | Spare Parts View | None | None |

> **Security Tip:** Never share Admin passwords with daily operating staff. Create individual accounts for cashiers and technicians to preserve clear accountability in the Audit Trail.

---

## 4. First-Time Setup & Store Configuration

Upon initial launch, follow these steps to configure your store's identity and receipt details:

1. **Log In as Admin:** Enter the default credentials provided during system installation.
2. **Navigate to Settings:** Click the **Settings** icon on the main navigation sidebar.
3. **Configure Store Profile:**
   - **Store Name:** Appears prominently at the top of receipts and invoices (e.g., *Khan Mobile & Repair Center*).
   - **Phone Numbers:** Contact numbers for customer support and warranty inquiries.
   - **Address:** Shop location, market name, and city printed on receipts.
   - **Tax / NTN (Optional):** Enter your sales tax or national tax number if applicable.
   - **Currency Symbol:** Set your local currency symbol (e.g., `Rs.`, `PKR`, `$`).
   - **Receipt Footer Note:** Custom greeting or terms (e.g., *"No returns without original receipt. Warranty void if seal is broken."*).
4. **Set Up Branches (If Multi-Branch):** If your business operates multiple branches, go to **Branches** to register each branch location.
5. **Create Staff Accounts:** Go to **Staff & Roles**, click **Add New Staff Member**, enter their username, role, initial PIN/password, and assign their default branch.

---

## 5. Cash Register & Shift Management

The Cash Register module guarantees that physical cash in the drawer matches digital transactions at all times.

### 5.1 Opening a Morning Shift
1. Navigate to **Cash Register** from the sidebar.
2. The system will prompt: *"No active cash session found."*
3. Click **Open Cash Session**.
4. Enter the **Opening Cash** (the physical float/petty cash left in the drawer for change, e.g., `10,000`).
5. Enter any opening notes and click **Start Session**.
6. The register is now active and ready to record sales.

### 5.2 Recording Mid-Day Cash In & Cash Out
Throughout the day, cash may leave or enter the register for non-sales purposes:
- **Cash Out:** Examples include paying lunch expenses, tea, delivery couriers, or cash handed to the owner.
  - Click **Add Cash Out**, enter the amount, select the reason (e.g., *Shop Expense* or *Owner Withdrawal*), and submit.
- **Cash In:** Examples include adding extra change float or cash deposits.
  - Click **Add Cash In**, enter the amount, note the source, and submit.

### 5.3 Closing the Register (End-of-Day Reconciliation)
1. At the end of the shift or day, navigate to **Cash Register**.
2. Click **Close Session**.
3. Count the physical cash in the cash drawer and enter it into **Physical Cash Counted**.
4. The system calculates:
   $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Sales} + \text{Cash In} - \text{Cash Out} - \text{Cash Refunds}$$
5. The screen displays any **Discrepancy (Over / Short)**.
6. Enter closing remarks and click **Confirm & Close Session**. A closing summary can be printed for the owner.

---

## 6. Inventory & Stock Management

### 6.1 Box-Packed (New) Mobile Phones & IMEI Intake
1. Go to **Inventory** > **New Phones**.
2. Click **Add New Device**.
3. Enter:
   - **Brand & Model:** (e.g., *Samsung Galaxy S24 Ultra*, *iPhone 16 Pro Max*)
   - **Color & Storage Variant:** (e.g., *Titanium Gray, 256GB*)
   - **IMEI 1 & IMEI 2:** Scan using your barcode scanner or type manually.
   - **Purchase Price (Cost):** Your wholesale cost per unit.
   - **Sale Price (Retail):** Standard shop selling price.
   - **Warranty:** Specify brand warranty duration (e.g., *12 Months Official*).
4. Click **Save Product**.
> **Duplicate Protection:** The system automatically checks and prevents duplicate IMEIs. If an IMEI is already registered in stock, an alert will prevent saving.

### 6.2 Used / Second-Hand Mobile Phone Purchases
When buying used phones from walk-in customers or traders, legal compliance and device verification are critical:
1. Go to **Purchasing** > **Buy Used Phone**.
2. **Seller Information:**
   - **Seller Full Name:** (e.g., *Ahmad Khan*)
   - **Seller CNIC / National ID:** Essential for legal compliance.
   - **Seller Phone Number:** Contact number.
3. **Device Details:**
   - **Model, Color, Storage:** (e.g., *Apple iPhone 13 128GB Midnight*)
   - **IMEI Number:** Scanned and verified.
   - **Battery Health % & Condition:** Note visible scratches, screen condition, or accessories included (Box, Original Charger).
4. **Valuation & Payment:**
   - **Purchase Price:** Agreed purchase price.
   - **Amount Paid Now:** Cash paid immediately to the seller.
   - **Outstanding Balance:** If paying partially, the remaining balance is automatically tracked in the seller's ledger.
5. Click **Record Purchase & Generate Intake Voucher**. Print the signed purchase agreement for your records.

### 6.3 Spare Parts Management
Used for repair jobs (screens, batteries, charging ICs, camera modules):
1. Go to **Inventory** > **Spare Parts**.
2. Click **Add Spare Part**.
3. Input Part Name, Compatible Models, Cost Price, Customer Retail Price, and Quantity on Hand.
4. Set **Minimum Stock Alert Level** (e.g., alert when fewer than 3 screens remain).

### 6.4 Accessories & General Products
For chargers, cables, protective glass, cases, and handsfree sets:
1. Go to **Inventory** > **Accessories**.
2. Scan the manufacturer's barcode on the packaging into the **Barcode** field.
3. Enter Title, Category, Cost Price, Selling Price, and Current Quantity.

### 6.5 Barcode Generation & Printing
For items without factory barcodes (or used devices):
1. Select the product in Inventory.
2. Click **Generate Barcode**.
3. Select label format (single sticker or multi-label sheet) and send to your barcode thermal printer.

---

## 7. Point of Sale (POS) & Billing

The POS screen is optimized for lightning-fast checkout using either a barcode scanner or quick search.

### 7.1 Adding Items — With or Without a Barcode Scanner
The system is built to work seamlessly whether you have dedicated retail hardware or just a standard keyboard and mouse:
- **With a Barcode Scanner:** Place your cursor in the scan field and scan the barcode. The product is added instantly to your cart.
- **Without a Barcode Scanner (Manual Typing):**
  1. Type the numeric barcode or SKU code into the **"Scan barcode or enter SKU"** input box and press <kbd>Enter</kbd> or click the **Find** button.
  2. Or, skip barcodes entirely: use the **Product Selector Dropdown** directly below the scan field. Start typing the phone model or accessory name (e.g., *Samsung A15*, *25W Fast Charger*, *AirPods Pro*) to select it directly.
  3. **Selecting IMEIs for Phones:** When choosing a mobile phone handset, the system displays a dropdown list of all currently available in-stock IMEI numbers for that model. Simply click the IMEI you are selling, or type the 15 digits manually.

### 7.2 Customer Selection & Discounts
- **Walk-in Customer:** Default for quick retail transactions.
- **Registered Customer:** Type customer name or mobile number to select or create a profile.
- **Item-Level Discount:** Click on an item line to reduce price.
- **Bill-Level Discount:** Enter overall invoice discount in Rupees or Percentage.
- *The screen clearly separates and highlights Total Cost, Discount Given, and Net Payable.*

### 7.3 Multi-Payment Modes
Customers can pay using one or combined payment methods:
- **Cash:** Enter amount received; the POS calculates change due.
- **Card / POS Terminal:** Enter bank slip / auth code.
- **Bank Transfer / Mobile Wallet:** JazzCash, EasyPaisa, or direct IBAN transfer.
- **Credit (Udhaar):** Bill is posted to the customer's ledger for future recovery (requires selecting a registered customer).

### 7.4 Invoices & Receipts — With or Without a Physical Printer
- **With a Physical Printer:**
  - **80mm Thermal Receipt:** Click **Print Invoice** to output a compact slip with store header, itemized breakdown, IMEI numbers, and warranty terms.
  - **A4 / A5 Invoices:** Supports standard laser or inkjet printers for formal corporate invoices.
- **Without a Physical Printer (Digital & Paperless Mode):**
  - **Save Digital PDF:** Click **Save PDF** to generate an official PDF file directly to your desktop. You can instantly send this PDF to the customer via **WhatsApp**, **Email**, or Bluetooth.
  - **System Print to PDF:** Select *Microsoft Print to PDF* or *Save as PDF* from the print dialog.
  - **100% Optional Printing:** You do **not** need to print receipts to complete transactions. Once you complete the sale, the sale is saved permanently in your database, your cash register is updated, inventory is deducted, and the invoice is archived in **Sales History** for anytime on-screen lookup.

---

## 8. Customer & Supplier Ledgers (Khata Accounts)

### 8.1 Customer Credit (Udhaar) Management
1. When completing a sale on credit, choose **Payment Mode: Customer Credit**.
2. The sale completes without cash drawer intake.
3. The customer's ledger is immediately debited with the invoice amount.

### 8.2 Receiving Customer Balance Payments
1. Go to **Khata / Customers**.
2. Search customer by name or phone number.
3. View their current outstanding balance and purchase history.
4. Click **Receive Payment**.
5. Enter the amount received, select payment method (Cash / Bank), and add reference notes.
6. The customer's balance updates in real time, and the cash is added to your active Cash Register session. Print a payment receipt for the customer.

### 8.3 Supplier & Seller Ledger Balances
- Used phone sellers or parts distributors with unpaid balances appear under **Suppliers / Payables**.
- Click **Pay Balance** to log payments, update ledger statements, and deduct cash from the register.

---

## 9. Mobile Repair & Service Center Workflow

The Repair module handles the complete service center lifecycle from customer intake to technician repair and delivery.

### 9.1 Receiving Faulty Devices & Job Card Intake
1. Navigate to **Repairs** > **New Job Card**.
2. **Customer Details:** Name, Mobile Number, Alternative Contact.
3. **Device Information:**
   - Brand, Model, Color, IMEI or Serial Number.
   - Security Passcode / Pattern (required for technician testing).
4. **Fault Description:** Customer reported problem (e.g., *No display after drop*, *Mic not working*, *Water damaged*).
5. **Physical Condition Checklist:** Check scratches, bent frame, cracked back, camera glass condition, SIM tray presence.
6. **Financial Estimates:**
   - **Estimated Repair Cost:** (e.g., `8,500`)
   - **Advance Deposit Received:** (e.g., `2,000`)
   - *If an advance deposit is collected in cash, it is instantly registered in the active Cash Register.*

### 9.2 Generating & Printing Job Card Receipts
1. Click **Create Job Card**.
2. Click **Print Job Card (PDF)**.
3. Hand the signed customer copy to the client. Keep the workshop copy attached to the device.

### 9.3 Assigning Technicians & Status Updates
As the device moves through the workshop, update its status:
- **Pending Intake** $\rightarrow$ **Assigned to Technician** $\rightarrow$ **In Progress** $\rightarrow$ **Waiting for Parts** $\rightarrow$ **Ready for Delivery / Completed**.

### 9.4 Consuming Spare Parts into Repairs
When a technician uses a new part (e.g., *iPhone 13 OLED Display*):
1. Open the Repair details page.
2. Under **Consumed Spare Parts**, click **Add Part to Repair**.
3. Select the spare part from inventory and enter quantity used.
4. Click **Consume Part**:
   - The part quantity is **automatically deducted from inventory stock**.
   - The cost of the part is tied to the repair job for accurate profit calculation.
   - The part is itemized on the final repair invoice.

### 9.5 Final Repair Billing, Delivery & Deposit Settlement
1. When the customer arrives to pick up their phone:
2. Open the Job Card.
3. Review total repair charges.
4. The system automatically subtracts the **Advance Deposit**:
   $$\text{Final Balance Payable} = \text{Total Repair Charges} - \text{Advance Deposit Paid}$$
5. Collect remaining balance, choose payment method, and click **Mark as Delivered & Close Job**.
6. Print the final Repair Warranty Invoice.

---

## 10. Returns, Replacements & IMEI Lifecycle Search

### 10.1 Processing Customer Returns
1. Go to **Sales** > **Sales History**.
2. Locate the invoice or scan the receipt barcode.
3. Click **Process Return**.
4. Select the item(s) being returned and indicate condition (Resellable Stock or Defective).
5. Choose refund type: Cash Refund, Store Credit, or Exchange.

### 10.2 Full IMEI Lifecycle History Inspection
To verify any phone that enters your shop:
1. Go to **IMEI Search**.
2. Scan or enter the 15-digit IMEI.
3. The system returns the complete chronological history:
   - When and from whom the device was purchased (including seller CNIC).
   - Cost price and intake branch.
   - Which invoice and customer it was sold to.
   - All repair tickets and parts consumed for this IMEI.
   - Active warranty status.

---

## 11. Expenses & Owner Drawings

### 11.1 Recording Daily Shop Expenses
1. Go to **Expenses** > **Add Expense**.
2. Choose Category (e.g., *Electricity, Shop Rent, Staff Tea/Food, Stationery, Generator Fuel*).
3. Enter Amount and Payment Source (*Cash Register* or *Bank Account*).
4. Click **Save Expense**.

### 11.2 Owner Drawings & Capital Injections
- **Owner Drawing:** Cash withdrawn by the shop owner for personal use (does not distort business operating profit).
- **Capital Injection:** Fresh funds deposited into the business by the owner.

---

## 12. Business Reports & Analytics

Access real-time reports via the **Reports** section:
- **Daily Sales & Gross Profit:** View total revenue, cost of goods sold (COGS), discounts, and net profit.
- **Cash Flow Summary:** Opening cash, sales inflows, expense outflows, customer payments, and closing cash.
- **Stock Valuation Report:** Total capital invested in phones, accessories, and spare parts at current cost price.
- **Low Stock & Reorder Alerts:** Instant list of fast-moving items nearing zero stock.
- **Technician Productivity Report:** Number of jobs completed, repair revenue generated, and turnaround time per technician.

---

## 13. Database Backups, Restore & Maintenance

Your shop's data is your most valuable asset. The system provides integrated backup tools.

### 13.1 Daily One-Click Backups
> **Golden Rule:** Create a backup at the end of every business day before turning off your computer.

1. Insert an external USB flash drive or specify a cloud sync folder (e.g., Google Drive, Dropbox, or OneDrive).
2. Go to **Settings** > **Database Backup & Restore**.
3. Click **Create Backup Now**.
4. Select your backup destination folder (e.g., your USB drive).
5. The system creates a timestamped, compressed backup file:  
   `mobileshop_backup_YYYY-MM-DD_HHMM.db`
6. A success notification verifies that the backup passed integrity validation.

### 13.2 Restoring from a Backup
If you replace your computer or need to recover from hardware failure:
1. Install Mobile Shop Desktop ERP on the new computer.
2. Go to **Settings** > **Database Backup & Restore**.
3. Click **Restore Database**.
4. Select your backup file (`.db`).
5. Confirm the restore prompt. The application safely loads all records, sales, inventory, and ledger history.

### 13.3 Audit Trail & Security Logs
The system logs every critical action (price edits, manual stock adjustments, cash voids, deleted entries, logins):
- Go to **Audit Trail** to inspect timestamps, operating user, branch, action type, and human-readable before/after details.

### 13.4 Automatic Software Updates
- When connected to the internet, the desktop app automatically checks for signed releases.
- If a critical update is published, a notification prompts you to click **Update & Restart**.
- Updates are cryptographically signed and applied without altering your existing database.

---

## 14. Frequently Asked Questions (FAQ) & Troubleshooting

**Q1: What happens if my shop loses internet connection?**  
**A:** Mobile Shop Desktop ERP is built entirely offline-first. All sales, barcodes, repairs, and cash management function with 100% speed and reliability without internet.

**Q2: How do I connect my 80mm thermal receipt printer?**  
**A:** Install the manufacturer's printer driver in Windows/macOS/Linux. In the ERP Print Dialog, select your thermal printer as the default device. The receipts are pre-formatted for standard 80mm roll width.

**Q3: Can I sell a phone if I haven't entered its IMEI yet?**  
**A:** For serialized box-packed phones, an IMEI is required to ensure warranty tracking and prevent inventory mismatches. For general accessories (chargers, cases), only a barcode or product code is required.

**Q4: A customer returned a repaired phone with a complaint under warranty. What should I do?**  
**A:** Search the IMEI in **IMEI Search** to bring up the original repair ticket. Click **Create Warranty Follow-up** to track the re-service without charging the customer again.

**Q5: How can I change the shop name or phone number on receipts?**  
**A:** Log in as **Admin**, navigate to **Settings**, edit your Store Name or Contact Information, and click **Save Settings**. New receipts will immediately reflect the changes.

---

*For technical assistance, software customizations, or hardware configuration, contact your system provider or Stack and Scale engineering support.*
