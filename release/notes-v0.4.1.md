### What's Changed in v0.4.1

#### 1. Integrated Help & Operations Center
- **Interactive User Guide**: Added a full in-app Help Center covering all 16 business modules: Quick Start & Roles, Cash Register & Shift Reconciliation, Operating Without Barcode Scanner / Printer, Inventory (New Phones, Used Purchases with CNIC, Spare Parts & Barcodes), POS & Checkout Billing, Installments (EMI Financing), Repair Workshop (5-stage Job Card Lifecycle), Warranties & Guarantees, Returns & Exchanges, Customer & Supplier Ledgers (Khata / Udhaar), Daily Expenses vs. Owner Drawings, IMEI Lifecycle Search, Business Reports & Profit Analytics, Staff Accounts, Multi-Branch & Audit Trail, Database Backup & Restore, and FAQ & Daily Shortcuts.
- **Top Navigation Quick Access**: Added `Help & Docs` button directly to the global top navigation bar for 1-click access from any screen.
- **Direct Module Navigation**: Embedded action buttons (*Open POS Screen*, *Go to Cash Register*, *Go to Workshop*, *View Customer Ledgers*, etc.) inside documentation topics that immediately switch to the active module.
- **Responsive Category Pills**: Replaced single-line overflowing row with wrapped pill layout, eliminating horizontal scrollbars across all screen widths.

#### 2. Enhanced UI & Account Navigation
- **Relocated User Profile & Sign Out**: Moved the user avatar, staff name, role badge, and `Sign out` button from the bottom of the sidebar up to the top-right header bar next to the offline status indicator.
- **Streamlined Sidebar Footer**: The bottom of the left sidebar is now dedicated exclusively to the collapse/expand sidebar toggle.

#### 3. Administrative Security Utilities
- **Standalone Password Reset Tool**: Added a dedicated CLI reset utility (`rust/src/bin/reset_password.rs`) allowing administrators to safely reset passwords for any registered user in the local database.

---

### Download & Installation Packages

| Platform | Recommended Package | Alternate Package |
| :--- | :--- | :--- |
| **Linux (x64)** | [AppImage](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP_0.4.1_amd64.AppImage) | [Debian (.deb)](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/mobile-shop-erp_0.4.1_amd64.deb) |
| **Windows (x64)** | [NSIS Installer (.exe)](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP_0.4.1_x64-setup.exe) | [MSI Package (.msi)](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP_0.4.1_x64_en-US.msi) |
| **macOS (Apple Silicon)** | [Apple Silicon DMG](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP_0.4.1_aarch64.dmg) | [Updater Payload (.app.tar.gz)](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP.app.tar.gz) |
| **macOS (Intel)** | [Intel DMG](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP_0.4.1_x64.dmg) | [Updater Payload (.app.tar.gz)](https://github.com/saadkhan2003/MobileShopERP/releases/download/v0.4.1/Mobile.Shop.ERP.app.tar.gz) |
