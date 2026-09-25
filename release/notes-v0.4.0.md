> **Critical Update**: This release resolves 10 confirmed QA defects across core ERP accounting, timezone display, repair parts tracking, IMEI duplicate handling, and cash session reconciliation. All desktop installations are required to upgrade to ensure accurate financial ledgers and document timestamps.
n
---

### What's Changed in v0.4.0

#### 1. Core Financial & Ledger Reconciliation
- **[[BUG-10] Used Phone Seller Ledger Balance (#10)](https://github.com/saadkhan2003/MobileShopERP/issues/10)**: Fixed contact ledger balance math so unpaid balances originating from used-phone purchases (`agreed_price - paid`) are properly reflected in the contact ledger balance and transaction list.
- **[[BUG-03] Sale Breakdown & Discount Display (#3)](https://github.com/saadkhan2003/MobileShopERP/issues/3)**: On-screen sale details now present a complete financial breakdown (Subtotal, Discount highlighted, Trade-in value, Total, Paid, and Remaining Balance) consistent with generated PDF invoices.
- **[[BUG-07] Cash Register Closing Report (#7)](https://github.com/saadkhan2003/MobileShopERP/issues/7)**: Resolved "Cash session not found" lookup errors by preventing cross-section row leakage and synchronizing canonical session selection.

#### 2. Repair Workshop & Inventory Tracking
- **[[BUG-04] Consumed Spare Parts Tracking (#4)](https://github.com/saadkhan2003/MobileShopERP/issues/4)**: Implemented backend repair details endpoint (`GET /api/repairs/{id}`) to return consumed spare parts (`repair_parts`), displaying used components on-screen and rendering them in the Job Card PDF.
- **[[BUG-05] Repair Update Prefilled Fields (#5)](https://github.com/saadkhan2003/MobileShopERP/issues/5)**: Opening an existing repair now pre-populates all saved fields (status, labor charge, technician, expected date). Spare part consumption form is decoupled to prevent form state collisions.

#### 3. Global Timezone & Date Formatting
- **[[BUG-06] Accurate Local Timezone Display (#6)](https://github.com/saadkhan2003/MobileShopERP/issues/6)**: Implemented localized timezone formatting (`formatDateTime`) across all UI grids, cash register sessions, IMEI history, audit logs, and PDF exports, resolving the ~5-hour UTC display offset and matching local shop time (PKT / UTC+05:00).

#### 4. Inventory & IMEI Protection
- **[[BUG-01] Duplicate IMEI Validation & Error Visibility (#1)](https://github.com/saadkhan2003/MobileShopERP/issues/1)**: Added pre-submit line-item duplicate detection, field-level error alerts, and clear structured backend error messages (`A phone with this IMEI already exists`).
- **[[BUG-02] Product Edit Form Prefilled (#2)](https://github.com/saadkhan2003/MobileShopERP/issues/2)**: Edit forms for existing products now reliably prefill saved name, retail price, cost, minimum price, and reorder levels.

#### 5. Management & User Experience
- **[[BUG-08] Human-Friendly IMEI History (#8)](https://github.com/saadkhan2003/MobileShopERP/issues/8)**: Replaced raw JSON dumps with structured, professional cards and tables for Handset Specifications, Sale & Customer records, Warranty Claims, Repair jobs, and Stock Movements.
- **[[BUG-09] Human-Readable Audit Trail (#9)](https://github.com/saadkhan2003/MobileShopERP/issues/9)**: Converted raw serialized audit JSON payloads into readable business action summaries (e.g., "Repair status changed to Delivered", "Payment recorded: Rs 2,000", "Updated shop branding").

---

### Resolved Issues
- Closes [#1](https://github.com/saadkhan2003/MobileShopERP/issues/1): Duplicate IMEI is rejected without a visible error
- Closes [#2](https://github.com/saadkhan2003/MobileShopERP/issues/2): Product edit fields are not prefilled with existing values
- Closes [#3](https://github.com/saadkhan2003/MobileShopERP/issues/3): Sale detail screen does not show applied discount
- Closes [#4](https://github.com/saadkhan2003/MobileShopERP/issues/4): Consumed repair part is missing from repair detail and Job Card PDF
- Closes [#5](https://github.com/saadkhan2003/MobileShopERP/issues/5): Repair update form is not prefilled
- Closes [#6](https://github.com/saadkhan2003/MobileShopERP/issues/6): Global date/time displays approximately 5 hours behind local time
- Closes [#7](https://github.com/saadkhan2003/MobileShopERP/issues/7): Cash Register 'Load Report' returns 'Cash session not found' for existing session
- Closes [#8](https://github.com/saadkhan2003/MobileShopERP/issues/8): IMEI History displays raw JSON instead of user-friendly history
- Closes [#9](https://github.com/saadkhan2003/MobileShopERP/issues/9): Audit Trail 'Details' column displays raw JSON
- Closes [#10](https://github.com/saadkhan2003/MobileShopERP/issues/10): Used-phone seller ledger balance does not include outstanding purchase balance

---

### Download & Installation Packages

| Platform | Recommended Package | Alternate Package |
| :--- | :--- | :--- |
| **Windows 10 / 11** | `windows-x64-Mobile.Shop.ERP_0.4.0_x64-setup.exe` | `windows-x64-Mobile.Shop.ERP_0.4.0_x64_en-US.msi` |
| **Linux (All distributions)** | `linux-x64-Mobile.Shop.ERP_0.4.0_amd64.AppImage` | `linux-x64-Mobile.Shop.ERP_0.4.0_amd64.deb` |
| **macOS (Apple Silicon M1/M2/M3)** | `macos-arm64-Mobile.Shop.ERP_0.4.0_aarch64.dmg` | `macos-arm64-Mobile.Shop.ERP.app.tar.gz` |
| **macOS (Intel)** | `macos-x64-Mobile.Shop.ERP_0.4.0_x64.dmg` | `macos-x64-Mobile.Shop.ERP.app.tar.gz` |

*Existing desktop installations will automatically detect this release via the signed update feed (`latest.json`) and apply the critical update.*
