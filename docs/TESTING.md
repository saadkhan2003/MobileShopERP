# Feature verification

Run `npm test` for the React UI tests and Rust integration tests. Run `npm run build` and `cargo check --manifest-path src-tauri/Cargo.toml` to verify the frontend bundle and desktop shell.

| Area | Automated checks |
| --- | --- |
| First run and access | Owner setup, login, logout, role restrictions, hidden cost fields, staff creation |
| Desktop UI | Setup form, login, dashboard metrics, product creation and edit forms, repair technician assignment, multi-date installment planning, used phone purchase, ledger and search submission, dated reports and their charts, scannable label rendering, grouped menu expansion, searchable record pickers, animated phone entry cards, global settings with logo upload, and all owner navigation screens |
| Products and stock | Categories and prices, accessory quantities, purchase intake, low stock, no overselling, stock movements, duplicate IMEI rejection |
| Phones and used stock | Individual IMEIs, phone sale only once, used purchase, seller balance payment, trade-in, IMEI history |
| Purchases and suppliers | Multi-line purchase, purchase lines, supplier payment, return, supplier balance and ledger |
| Sales and customers | Item totals, discounts, split payments, credit balance, invoice detail, customer ledger, partial refunds and phone returns with IMEI state, stock, payment, installment and audit links |
| Installments | Schedule during sale, schedule after sale, collection, duplicate schedule rejection, overpayment rejection |
| Repairs and warranty | Job creation and status, spare part stock consumption and cost, repair payment, warranty claim and expiry, claim resolution |
| Finance and reports | Expenses, drawings, cash reconciliation and daily close details, customer refunds, market rates, price history, dashboard and reports |
| Safety | Repeatable SQL seed, SQLite integrity and foreign key checks, local and external backup, verification, restore and unauthorized action rejection |
| Documents | PDF invoice and repair job card generation, multi-page invoice content |

The SQL fixture is [demo-seed.sql](../scripts/demo-seed.sql). The read-only [demo-check.sql](../scripts/demo-check.sql) verifies stock movements, purchase totals, sale totals, installments, repair costs and database integrity after seeding. The live database was backed up before loading the fixture.

The 20 UI tests use a mocked Tauri command bridge, while 14 Rust integration tests use disposable SQLite databases and the real backend. The Linux `.deb` and executable build. A second instance was launched in isolated Xvfb with its own SQLite database and automated X11 input: owner setup and login, supplier and product dropdown closing, purchase intake, checkout, sale return, scrolling, date picker closing, native PDF save dialog, readable saved invoice and repair job card, print dialog opening, external folder picker, backup verification and restore, and daily closing were exercised in the actual Tauri/WebKit window. A scanner-style keyboard entry also selected a product by SKU. The print dialog exposed only **Print to File** because no shop receipt printer is connected. A physical receipt printer and barcode scanner must still be checked on the shop hardware; their hardware behavior cannot be established by automated tests on this machine. Cloud backup and multi-branch synchronization are not implemented in this offline release.

The signed update was exercised with two public GitHub releases. The 0.2.0 AppImage detected 0.2.1, downloaded and accepted the signed package, and its on-disk file matched the published 0.2.1 package byte for byte. Reopening the updated AppImage reported the latest version. Automatic window relaunch after the update did not occur in the isolated `--appimage-extract-and-run` Xvfb setup; verify restart behavior on the intended desktop machine before shop rollout.

The [0.3.0 signed release](https://github.com/saadkhan2003/MobileShopERP/releases/tag/v0.3.0) passed its GitHub Actions tests and signed builds on Linux, Windows, and both macOS architectures. The published `latest.json` has six installer-specific routes: AppImage, Debian, NSIS, MSI, Apple Silicon app, and Intel app. Each route was checked against a published package and `.sig` file. The old 0.2.x release feed now serves the 0.3.0 manifest, so existing installations can discover the new repository's packages. Installation and update behavior for Windows and macOS still need checks on those operating systems; this Linux machine cannot establish that native behavior.
