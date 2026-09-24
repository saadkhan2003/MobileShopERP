# Desktop delivery now, subscription control panel later

The current desktop release does not contain tenant or subscription enforcement. The 30-day `sessions.expires_at` value is a login-session timeout, not a license term. Do not use that value to calculate the customer's renewal date.

## First customer period

For a shop whose monthly service starts on **24 September 2026** in **Asia/Karachi**, record the agreement separately from the desktop database:

| Field | Value |
| --- | --- |
| Customer/shop reference | Assign a stable ID in your customer register |
| Billing timezone | `Asia/Karachi` |
| Service start | `2026-09-24` |
| Current period start | `2026-09-24` |
| Current period end, exclusive | `2026-10-24` |
| Next renewal date | `2026-10-24` |
| Billing anchor day | `24` |
| First invoice/payment status | Record the actual invoice and payment separately |

The first term covers 24 September through 23 October. Each later monthly term starts on the 24th. Record whether the first month was paid; a service start date alone does not prove payment. Keep the customer agreement or invoice as evidence of the start date.

## Import into the future control panel

1. Create a tenant for this shop and link its desktop installation to that tenant. Preserve the existing SQLite shop database and make a verified backup before linking.
2. Import the original `service_started_on`, current period boundaries, timezone, billing anchor, invoices, and payment state. Keep an audit entry showing that these were imported from the original desktop agreement.
3. Set the **next** invoice to the next unpaid renewal date. The SaaS launch date is a technical migration date, not a new paid service start. Do not bill the already-paid first term again.
4. Make the control panel authoritative for subscription state. Issue short-lived, signed desktop entitlements using a license-signing key separate from the app-update signing key. Define an offline grace period and allow viewing/exporting shop data after expiry even if new transactions are suspended.
5. Move an installation between tenants only through an audited owner/admin operation; never infer its tenant solely from the editable shop name.

If the control panel launches after a renewal date, reconcile invoices and payments first. Preserve the original service start and billing anchor; mark any missed period paid or overdue based on the actual agreement instead of shifting all dates to the control-panel launch date.
