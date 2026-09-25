import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  HelpCircle,
  Coins,
  Boxes,
  ShoppingBag,
  Wrench,
  Users,
  HardDrive,
  BarChart3,
  Keyboard,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Printer,
  Barcode,
  CalendarClock,
  RotateCcw,
  Building2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface Topic {
  id: string;
  category: string;
  title: string;
  summary: string;
  badge?: string;
  content: React.ReactNode;
}

interface HelpCenterProps {
  onNavigate?: (section: string) => void;
}

export function HelpCenter({ onNavigate }: HelpCenterProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTopicId, setActiveTopicId] = useState("quick-start");

  const categories = [
    { id: "all", label: "All Topics", icon: <BookOpen size={16} /> },
    { id: "roles", label: "Quick Start & Roles", icon: <ShieldCheck size={16} /> },
    { id: "cash", label: "Cash Register", icon: <Coins size={16} /> },
    { id: "paperless", label: "No Scanner / Printer", icon: <Printer size={16} /> },
    { id: "inventory", label: "Inventory & Stock", icon: <Boxes size={16} /> },
    { id: "pos", label: "POS & Billing", icon: <ShoppingBag size={16} /> },
    { id: "installments", label: "Installments (EMI)", icon: <CalendarClock size={16} /> },
    { id: "repairs", label: "Repair Workshop", icon: <Wrench size={16} /> },
    { id: "warranties", label: "Warranties & Claims", icon: <ShieldCheck size={16} /> },
    { id: "returns", label: "Returns & Exchanges", icon: <RotateCcw size={16} /> },
    { id: "khata", label: "Customer & Khata", icon: <Users size={16} /> },
    { id: "finance", label: "Expenses & Drawings", icon: <Wallet size={16} /> },
    { id: "imei", label: "IMEI Lifecycle", icon: <Smartphone size={16} /> },
    { id: "reports", label: "Reports & Profit", icon: <BarChart3 size={16} /> },
    { id: "management", label: "Staff & Branches", icon: <Building2 size={16} /> },
    { id: "backup", label: "Backups & Security", icon: <HardDrive size={16} /> },
    { id: "faq", label: "FAQ & Shortcuts", icon: <HelpCircle size={16} /> },
  ];

  const topics: Topic[] = useMemo(
    () => [
      {
        id: "quick-start",
        category: "roles",
        title: "Quick Start & System Roles",
        summary: "Introduction to offline-first ERP architecture and role-based permissions.",
        badge: "Essential",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <strong>⚡ 100% Offline-First Architecture:</strong> This application runs completely on your local computer. It does not require an active internet connection to process sales, manage stock, create job cards, or calculate daily cash. Your business data remains safe and private on your machine.
            </div>

            <h4 className="font-semibold text-base text-foreground">User Roles &amp; Permissions Matrix</h4>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted font-medium text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Cash Register</th>
                    <th className="p-2.5">POS Sales</th>
                    <th className="p-2.5">Workshop</th>
                    <th className="p-2.5">Inventory</th>
                    <th className="p-2.5">Reports</th>
                    <th className="p-2.5">Settings &amp; Backup</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-2.5 font-bold text-foreground">Admin / Owner</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-foreground">Manager</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-amber-600">View Only</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-foreground">Cashier</td>
                    <td className="p-2.5 text-blue-600 font-medium">Own Shift</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Access</td>
                    <td className="p-2.5 text-blue-600">Receive Only</td>
                    <td className="p-2.5 text-muted-foreground">View Only</td>
                    <td className="p-2.5 text-muted-foreground">Shift Only</td>
                    <td className="p-2.5 text-muted-foreground">—</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-foreground">Technician</td>
                    <td className="p-2.5 text-muted-foreground">—</td>
                    <td className="p-2.5 text-muted-foreground">—</td>
                    <td className="p-2.5 text-emerald-600 font-medium">Full Workshop</td>
                    <td className="p-2.5 text-blue-600">Parts Stock</td>
                    <td className="p-2.5 text-muted-foreground">—</td>
                    <td className="p-2.5 text-muted-foreground">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-2">
              {onNavigate && (
                <Button size="sm" variant="outline" onClick={() => onNavigate("settings")}>
                  Configure Shop Settings <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "cash-register",
        category: "cash",
        title: "Cash Register & Shift Reconciliation",
        summary: "Step-by-step shift control: opening float, cash in/out, and end-of-day discrepancy reconciliation.",
        badge: "Daily Routine",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              The <strong>Cash Register</strong> eliminates counter shortages and ensures physical drawer cash always matches system sales.
            </p>

            <div className="space-y-3">
              <div className="rounded-md border p-3 bg-muted/30">
                <h5 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
                  Morning Opening Float
                </h5>
                <p className="mt-1 text-xs text-muted-foreground">
                  At the beginning of each day/shift, navigate to <strong>Cash Register</strong>. If no session is active, click <strong>Open Cash Session</strong>. Count the physical cash left in the drawer for change (e.g. <code>Rs 10,000</code>), type the amount, and click <strong>Start Session</strong>.
                </p>
              </div>

              <div className="rounded-md border p-3 bg-muted/30">
                <h5 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
                  Mid-Day Cash In &amp; Cash Out
                </h5>
                <p className="mt-1 text-xs text-muted-foreground">
                  Whenever money is taken out of the drawer for shop expenses (lunch, tea, bills, generator fuel, or owner drawings), record a <strong>Cash Out</strong>. If extra change is added, record a <strong>Cash In</strong>. This prevents false cash shortages at night.
                </p>
              </div>

              <div className="rounded-md border p-3 bg-muted/30">
                <h5 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">3</span>
                  End-of-Day Closing &amp; Discrepancy
                </h5>
                <p className="mt-1 text-xs text-muted-foreground">
                  At closing, click <strong>Close Session</strong>. Count the actual cash in the drawer and type it into <strong>Physical Cash Counted</strong>. The system instantly computes:
                </p>
                <div className="mt-2 rounded bg-background p-2 font-mono text-xs border text-center">
                  Expected = Opening + Cash Sales + Cash In - Cash Out - Cash Refunds
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  If the counted cash matches, it displays <span className="text-emerald-600 font-semibold">Balanced</span>. If there is a variance, it reports exact <strong>Over</strong> or <strong>Short</strong>.
                </p>
              </div>
            </div>

            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate("cash")}>
                Go to Cash Register <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "paperless-operations",
        category: "paperless",
        title: "Operating Without Barcode Scanner or Printer",
        summary: "How to use keyboard typing, product search dropdowns, and digital PDF / paperless mode.",
        badge: "Special Guide",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <strong>✨ No Hardware Required:</strong> You can run your entire retail and repair shop using just a standard laptop or desktop with a keyboard and mouse. A physical barcode scanner and receipt printer are completely optional!
            </div>

            <h4 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Barcode size={18} className="text-primary" /> 1. Operating Without a Barcode Scanner
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong>Manual Barcode or SKU Typing:</strong> In the POS screen, simply type the barcode digits or SKU code into the <code>Scan barcode or enter SKU</code> field and press <kbd className="rounded border bg-muted px-1">Enter</kbd> or click <strong>Find</strong>.
              </li>
              <li>
                <strong>Product Search Dropdown:</strong> Directly beneath the scan field, click the <strong>Product dropdown</strong>. Start typing the name of the handset or accessory (e.g. <em>Samsung A15</em>, <em>25W Charger</em>, <em>Handsfree</em>) to pick it immediately.
              </li>
              <li>
                <strong>Selecting Handset IMEIs:</strong> When selling mobile phones, you do not need to scan the box. The system provides a dropdown showing all available in-stock IMEIs for that model. Click the one you want to sell, or type its 15 digits.
              </li>
            </ul>

            <h4 className="font-semibold text-base text-foreground flex items-center gap-2 pt-2">
              <Printer size={18} className="text-primary" /> 2. Operating Without a Physical Printer (Digital Paperless Mode)
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong>Built-in Digital PDF Invoices:</strong> Click <strong>Save PDF</strong> on any sale or repair job card. The ERP will save an official PDF directly to your computer. You can immediately send this PDF to your customer via <strong>WhatsApp</strong>, Email, or Bluetooth.
              </li>
              <li>
                <strong>Printing is 100% Optional:</strong> Completing a sale or delivering a repair never requires printing a paper receipt. The moment you confirm, cash is logged, stock is deducted, and the transaction is permanently archived in <strong>Sales History</strong>.
              </li>
              <li>
                <strong>Anytime On-Screen Lookup:</strong> Need to verify a past purchase or warranty? Just search the customer’s phone number, invoice number, or IMEI to view the full bill on-screen anytime.
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: "inventory-guide",
        category: "inventory",
        title: "Inventory: New Phones, Used Phones & Parts",
        summary: "IMEI duplicate prevention, used phone CNIC legal intake, spare parts, and barcode printing.",
        badge: "Stock Control",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">1. Box-Packed (New) Phones</h4>
            <p className="text-xs text-muted-foreground">
              New mobile phones are tracked by their unique 15-digit IMEI. The ERP includes built-in duplicate IMEI validation that prevents registering the same phone twice.
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              <li>Record Brand, Model, Color, and Storage Variant.</li>
              <li>Enter or scan IMEI 1 (and optional IMEI 2).</li>
              <li>Set Purchase Cost, Selling Retail Price, and Brand Warranty duration.</li>
            </ul>

            <h4 className="font-semibold text-base text-foreground pt-2">2. Used / Second-Hand Phone Purchases</h4>
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠️ Legal Protection:</strong> When buying used phones from customers or dealers, always enter the seller's full Name, CNIC (National ID), and Phone Number. Record battery health % and cosmetic grade (A/B/C).
            </div>
            <p className="text-xs text-muted-foreground">
              If you pay the seller partially, the remaining balance is automatically tracked in their <strong>Seller Ledger</strong> for future payout.
            </p>

            <h4 className="font-semibold text-base text-foreground pt-2">3. Spare Parts &amp; Minimum Stock Alerts</h4>
            <p className="text-xs text-muted-foreground">
              Keep LCD displays, batteries, charging ports, and camera modules in <strong>Spare Parts</strong>. Set a <em>Minimum Reorder Level</em> (e.g. 2 units) so the system alerts you before you run out of stock during urgent repairs.
            </p>

            <div className="flex gap-2 pt-1">
              {onNavigate && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onNavigate("phones")}>
                    New Phones <ArrowRight size={14} className="ml-1" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNavigate("used")}>
                    Used Purchases <ArrowRight size={14} className="ml-1" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "pos-guide",
        category: "pos",
        title: "Point of Sale (POS) & Checkout Billing",
        summary: "Fast barcode lookup, itemized & bill discounts, multi-payment methods, and thermal receipts.",
        badge: "Checkout",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">Standard Checkout Workflow</h4>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong>Add Products:</strong> Scan barcode, type SKU/barcode, or select from the product dropdown.
              </li>
              <li>
                <strong>Select Customer:</strong> Keep as <em>Walk-in Customer</em> for rapid sales, or select an existing customer to track warranty and credit.
              </li>
              <li>
                <strong>Discounts:</strong> You can apply a discount directly to an individual item or enter a total invoice discount (Rupees or Percentage). The on-screen summary highlights:
                <div className="mt-1 font-mono text-[11px] bg-muted/50 p-1.5 rounded border">
                  Total Cost &rarr; Discount Deducted &rarr; Net Payable
                </div>
              </li>
              <li>
                <strong>Payment Mode:</strong> Choose <strong>Cash</strong>, <strong>Card</strong>, <strong>Bank Transfer / EasyPaisa / JazzCash</strong>, or <strong>Customer Credit (Udhaar)</strong>.
              </li>
              <li>
                <strong>Complete &amp; Print:</strong> Print an 80mm thermal receipt, print an A4 invoice, or save as a digital PDF.
              </li>
            </ol>

            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate("sales")}>
                Open POS Screen <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "installments-guide",
        category: "installments",
        title: "Installments & Payment Plans (EMI)",
        summary: "Manage device installment contracts, advance down payments, monthly schedules, and overdue collections.",
        badge: "Financing",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              Mobile Shop ERP provides a full installment and hire-purchase financing engine designed for retail smartphone sales.
            </p>

            <div className="space-y-3 text-xs">
              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">1. Creating an Installment Plan</span>
                <p className="text-muted-foreground mt-0.5">
                  Select a verified registered customer, choose the smartphone IMEI, enter the agreed total financed price, and specify the <strong>Advance Down Payment</strong> (e.g. 30%). Set the duration (e.g. 3, 6, or 12 months). The system generates an exact installment schedule with monthly due dates.
                </p>
              </div>

              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">2. Collecting Monthly Payments</span>
                <p className="text-muted-foreground mt-0.5">
                  When a customer comes in to pay their monthly installment, open <strong>Installments</strong>, locate their account, click <strong>Receive Payment</strong>, and select the installment number. Cash is instantly received into your active Cash Register session.
                </p>
              </div>

              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">3. Overdue &amp; Defaulter Tracking</span>
                <p className="text-muted-foreground mt-0.5">
                  The dashboard and installments screen automatically flag payments that have crossed their due date with amber/red alerts, allowing you to follow up quickly.
                </p>
              </div>
            </div>

            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate("installments")}>
                Go to Installments <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "repairs-guide",
        category: "repairs",
        title: "Mobile Repair & Workshop Management",
        summary: "5-stage workshop lifecycle: Job Card intake, technician assignment, consuming spare parts, and advance deposit settlement.",
        badge: "Service Center",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              The Repair Center is designed for professional repair workshops and mobile service centers.
            </p>

            <div className="space-y-3 text-xs">
              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">Stage 1: Job Card Intake &amp; Advance Deposit</span>
                <p className="text-muted-foreground mt-0.5">
                  Record customer details, handset model, IMEI/serial, unlock passcode/pattern, reported fault (e.g. <em>cracked screen</em>, <em>not charging</em>), and physical condition. Collect an <strong>Advance Cash Deposit</strong> (e.g. Rs 1,000) which is immediately logged into your Cash Register.
                </p>
              </div>

              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">Stage 2: Customer Job Card Printout</span>
                <p className="text-muted-foreground mt-0.5">
                  Print the official Job Card receipt (or save PDF). Give the customer their claim voucher and attach the workshop slip to the phone.
                </p>
              </div>

              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">Stage 3: Consuming Spare Parts</span>
                <p className="text-muted-foreground mt-0.5">
                  When replacing a screen or battery, open the repair details and click <strong>Add Part to Repair</strong>. The part is <strong>automatically deducted from your inventory stock</strong> and added to the repair job cost for accurate profitability.
                </p>
              </div>

              <div className="rounded border p-2.5 bg-muted/20">
                <span className="font-bold text-foreground">Stage 4: Delivery &amp; Advance Settlement</span>
                <p className="text-muted-foreground mt-0.5">
                  When the customer collects their repaired device, the system automatically subtracts the advance deposit:
                </p>
                <div className="mt-1 font-mono text-[11px] bg-background p-1.5 rounded border text-center">
                  Final Payable = Total Repair Charges - Advance Deposit Paid
                </div>
                <p className="text-muted-foreground mt-1">
                  Collect the remaining balance, click <strong>Mark as Delivered</strong>, and print the warranty invoice.
                </p>
              </div>
            </div>

            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate("repairs")}>
                Go to Workshop <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "warranties-guide",
        category: "warranties",
        title: "Warranties, Guarantees & Repair Claims",
        summary: "Track brand official warranty, store check warranty, and workshop repair service guarantees.",
        badge: "Warranties",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">Three Types of Warranty Tracking</h4>
            <div className="space-y-2.5 text-xs">
              <div className="rounded border p-2.5">
                <strong className="text-foreground">1. Official Brand Warranty (Box-Packed Phones)</strong>
                <p className="text-muted-foreground mt-0.5">
                  When receiving box-packed devices, set the warranty period (e.g. 12 Months Official). The sale receipt clearly prints the warranty expiration date calculated from purchase date.
                </p>
              </div>
              <div className="rounded border p-2.5">
                <strong className="text-foreground">2. Store Check Warranty (Used Phones)</strong>
                <p className="text-muted-foreground mt-0.5">
                  For second-hand handsets, specify check warranty duration (e.g. 7 Days Checking Warranty). If returned within this period, warranty validation passes.
                </p>
              </div>
              <div className="rounded border p-2.5">
                <strong className="text-foreground">3. Service &amp; Parts Warranty (Repairs)</strong>
                <p className="text-muted-foreground mt-0.5">
                  When completing a repair (such as an OLED screen replacement), assign a service warranty (e.g. 1 Month). If the customer brings the device back, search the Job Card or IMEI to verify valid warranty before servicing.
                </p>
              </div>
            </div>

            {onNavigate && (
              <Button size="sm" variant="outline" onClick={() => onNavigate("warranties")}>
                View Warranties Screen <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "returns-guide",
        category: "returns",
        title: "Returns, Replacements & Partial Refunds",
        summary: "Handle customer returns, restock serialized handsets, and adjust cash or credit ledgers.",
        badge: "Operations",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">Processing Customer Returns</h4>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong>Locate the Sale:</strong> Find the original invoice from <strong>Sales History</strong> using the invoice number, customer phone, or device IMEI.
              </li>
              <li>
                <strong>Select Return Type:</strong> Choose whether the customer is returning the entire bill or a specific item (e.g. just a charger from a multi-item purchase).
              </li>
              <li>
                <strong>Handset Restocking:</strong> If returning a mobile phone, the phone's 15-digit IMEI is <strong>automatically restored to active inventory</strong> so it can be resold.
              </li>
              <li>
                <strong>Refund Mechanism:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li><strong>Cash Refund:</strong> Cash is paid out and automatically deducted from the active cash register session.</li>
                  <li><strong>Ledger Credit:</strong> If the original sale was on credit (Khata), the customer's outstanding balance is automatically reduced.</li>
                </ul>
              </li>
            </ol>
          </div>
        ),
      },
      {
        id: "khata-guide",
        category: "khata",
        title: "Customer & Supplier Ledgers (Khata / Udhaar)",
        summary: "Credit sales, receiving customer balance payments, supplier payables, and transaction statements.",
        badge: "Accounts",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">1. Selling on Credit (Udhaar)</h4>
            <p className="text-xs text-muted-foreground">
              Select a registered customer in POS and choose <strong>Payment Mode: Customer Credit</strong>. The sale completes without cash intake, and the customer’s Khata balance is debited.
            </p>

            <h4 className="font-semibold text-base text-foreground pt-1">2. Receiving Customer Payments</h4>
            <p className="text-xs text-muted-foreground">
              Go to <strong>Customer Ledger</strong>, search the customer by name or phone, view their total outstanding debt, and click <strong>Receive Payment</strong>. The payment immediately updates their running balance and adds cash to your active cash register session. Print or share their receipt.
            </p>

            <h4 className="font-semibold text-base text-foreground pt-1">3. Supplier &amp; Used Phone Seller Payables</h4>
            <p className="text-xs text-muted-foreground">
              Wholesale parts suppliers and used-phone sellers with pending balances appear under <strong>Suppliers / Payables</strong>. Clear outstanding balances with one click.
            </p>

            {onNavigate && (
              <Button size="sm" variant="outline" onClick={() => onNavigate("ledger")}>
                View Customer Ledgers <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "expenses-drawings",
        category: "finance",
        title: "Daily Expenses vs. Owner Drawings",
        summary: "Clear distinction between business operational expenses and personal owner drawings for accurate profit.",
        badge: "Finance",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <strong>💡 Accounting Golden Rule:</strong> Never mix personal withdrawals with shop utility expenses. Mixing them distorts your true net profit and tax reporting.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded border p-3 bg-card">
                <span className="font-bold text-foreground">Shop Operating Expenses</span>
                <p className="text-muted-foreground mt-1">
                  Expenses incurred to run the store: electricity bills, shop rent, staff lunch/tea, generator petrol, and cleaning supplies. These directly reduce your <strong>Operating Net Profit</strong>.
                </p>
              </div>
              <div className="rounded border p-3 bg-card">
                <span className="font-bold text-foreground">Owner Personal Drawings</span>
                <p className="text-muted-foreground mt-1">
                  Money withdrawn by the shop owner for personal or household use. These do <em>not</em> count as an operating cost; they reduce owner equity/capital balance while keeping business profit figures accurate.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {onNavigate && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onNavigate("expenses")}>
                    Shop Expenses <ArrowRight size={14} className="ml-1" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNavigate("drawings")}>
                    Owner Drawings <ArrowRight size={14} className="ml-1" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "imei-guide",
        category: "imei",
        title: "Full IMEI Lifecycle Search & Tracking",
        summary: "Trace complete chronological history of any 15-digit IMEI from purchase to sale, warranty, and repairs.",
        badge: "Traceability",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              The <strong>IMEI Search</strong> module provides end-to-end device traceability for dispute resolution and warranty verification.
            </p>

            <div className="rounded-lg border p-3 bg-muted/20 text-xs space-y-2">
              <span className="font-semibold text-foreground">Chronological Timeline Displayed:</span>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><strong>Purchase Details:</strong> Date, intake branch, cost price, supplier or used-phone seller name and CNIC.</li>
                <li><strong>Sales Details:</strong> Date sold, invoice number, customer name, phone number, and selling price.</li>
                <li><strong>Active Warranty:</strong> Duration and remaining warranty days.</li>
                <li><strong>Service History:</strong> Every repair job card, fault reported, and spare part replaced on this specific device.</li>
              </ul>
            </div>

            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate("history")}>
                Open IMEI Search <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "reports-guide",
        category: "reports",
        title: "Business Reports & Financial Analytics",
        summary: "Real-time daily sales, net profit calculations, inventory valuation at cost, and technician performance.",
        badge: "Analytics",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <p className="text-xs text-muted-foreground">
              Get an instant high-level overview of your store’s financial health without complex accounting:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded border p-3 bg-card">
                <span className="font-semibold text-foreground">Daily Sales &amp; Gross Margin</span>
                <p className="text-muted-foreground mt-1">
                  Track total daily turnover, cost of goods sold (COGS), total discounts given, and net profit in Rupees.
                </p>
              </div>
              <div className="rounded border p-3 bg-card">
                <span className="font-semibold text-foreground">Stock Valuation at Cost</span>
                <p className="text-muted-foreground mt-1">
                  Calculates total capital invested in box-packed phones, pre-owned devices, accessories, and spare parts.
                </p>
              </div>
              <div className="rounded border p-3 bg-card">
                <span className="font-semibold text-foreground">Technician Productivity</span>
                <p className="text-muted-foreground mt-1">
                  Inspect the number of repair jobs completed, revenue collected, and turnaround efficiency per technician.
                </p>
              </div>
              <div className="rounded border p-3 bg-card">
                <span className="font-semibold text-foreground">Cash Flow Summary</span>
                <p className="text-muted-foreground mt-1">
                  Reconciles cash inflows vs operational expense outflows (rent, electricity, tea/food, salaries).
                </p>
              </div>
            </div>

            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate("reports")}>
                View Financial Reports <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "management-guide",
        category: "management",
        title: "Staff Accounts, Branches & Audit Trail",
        summary: "Configuring employee roles, multi-branch operations, and auditing sensitive activities.",
        badge: "Management",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">1. Creating Employee Accounts</h4>
            <p className="text-xs text-muted-foreground">
              Under <strong>Staff</strong>, create individual logins for each employee with their role: Manager, Cashier, Salesman, or Technician. Individual accounts guarantee that all sales, discounts, and drawer openings are strictly attributed to the responsible person.
            </p>

            <h4 className="font-semibold text-base text-foreground pt-1">2. Multi-Branch Operations</h4>
            <p className="text-xs text-muted-foreground">
              If your business operates multiple shops or warehouse locations, register them in <strong>Branches</strong>. Products, handsets, and repair tickets are segregated by branch while allowing consolidated reporting.
            </p>

            <h4 className="font-semibold text-base text-foreground pt-1">3. Immutable Audit Trail</h4>
            <p className="text-xs text-muted-foreground">
              Every sensitive activity (changing a price, voiding a transaction, deleting a line item, modifying stock) is permanently recorded in the <strong>Audit Trail</strong> with the exact user, timestamp, and before/after values to protect against employee theft or fraud.
            </p>

            {onNavigate && (
              <Button size="sm" variant="outline" onClick={() => onNavigate("audit")}>
                View Audit Trail <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "backup-guide",
        category: "backup",
        title: "Database Backups, Restore & Security",
        summary: "One-click USB backup routine, system restoration, audit trail, and automatic updates.",
        badge: "Security",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 text-xs">
              <strong>💾 Golden Business Rule:</strong> Always make a 1-click database backup to an external USB flash drive or cloud sync folder (Google Drive / OneDrive) at the end of each business day before shutting down your computer!
            </div>

            <h4 className="font-semibold text-base text-foreground">1. Creating a Daily Backup</h4>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Plug your USB drive into the computer.</li>
              <li>Go to <strong>Settings</strong> &rarr; <strong>Database Backup &amp; Restore</strong>.</li>
              <li>Click <strong>Create Backup Now</strong> and select your USB drive folder.</li>
              <li>A timestamped file (e.g. <code>mobileshop_backup_2026-09-25.db</code>) is saved in 2 seconds.</li>
            </ol>

            <h4 className="font-semibold text-base text-foreground pt-1">2. Restoring on a New Computer</h4>
            <p className="text-xs text-muted-foreground">
              If your computer is replaced, install Mobile Shop ERP on the new computer, open <strong>Backup &amp; Restore</strong>, click <strong>Restore Database</strong>, and select your backup file. All stock, bills, and ledgers are instantly restored.
            </p>

            <h4 className="font-semibold text-base text-foreground pt-1">3. Audit Trail Logs</h4>
            <p className="text-xs text-muted-foreground">
              The system records an unalterable log of every sensitive action (stock adjustments, price modifications, voids, cash movements) tagged with the staff username and timestamp.
            </p>

            {onNavigate && (
              <Button size="sm" variant="outline" onClick={() => onNavigate("backup")}>
                Backup Settings <ArrowRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "faq-shortcuts",
        category: "faq",
        title: "Frequently Asked Questions & Shortcuts",
        summary: "Troubleshooting common shop situations and daily keyboard shortcuts.",
        badge: "Support",
        content: (
          <div className="space-y-4 text-sm leading-relaxed">
            <h4 className="font-semibold text-base text-foreground">Common Questions</h4>
            <div className="space-y-3 text-xs">
              <div className="rounded border p-3">
                <span className="font-bold text-foreground">Q: Does the app stop working if our internet goes down?</span>
                <p className="text-muted-foreground mt-1">
                  <strong>A:</strong> No! The system is 100% offline-first. All inventory, billing, repair tracking, and cash registers function normally without internet.
                </p>
              </div>
              <div className="rounded border p-3">
                <span className="font-bold text-foreground">Q: What if a customer wants a receipt sent to WhatsApp?</span>
                <p className="text-muted-foreground mt-1">
                  <strong>A:</strong> Click <strong>Save PDF</strong> on the completed sale or repair ticket. Save the PDF to your desktop and drag it directly into WhatsApp Web or send via phone.
                </p>
              </div>
              <div className="rounded border p-3">
                <span className="font-bold text-foreground">Q: How do I change the shop name or phone number on receipts?</span>
                <p className="text-muted-foreground mt-1">
                  <strong>A:</strong> Log in as Admin, navigate to <strong>Settings</strong>, update your shop name, contact number, or address, and click <strong>Save Settings</strong>.
                </p>
              </div>
              <div className="rounded border p-3">
                <span className="font-bold text-foreground">Q: Can I edit a product's price if the market rate changed?</span>
                <p className="text-muted-foreground mt-1">
                  <strong>A:</strong> Yes, go to <strong>Products</strong>, click <strong>Edit</strong> on the item, update the cost or retail price, and save. The ERP archives past price history automatically.
                </p>
              </div>
            </div>

            <h4 className="font-semibold text-base text-foreground pt-2 flex items-center gap-2">
              <Keyboard size={16} /> Useful Shortcuts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between border rounded p-2 bg-muted/20">
                <span>Find product / Barcode</span>
                <kbd className="rounded border bg-background px-2 py-0.5 font-mono text-[10px]">Enter</kbd>
              </div>
              <div className="flex items-center justify-between border rounded p-2 bg-muted/20">
                <span>Print receipt / invoice</span>
                <kbd className="rounded border bg-background px-2 py-0.5 font-mono text-[10px]">Ctrl + P</kbd>
              </div>
              <div className="flex items-center justify-between border rounded p-2 bg-muted/20">
                <span>Toggle sidebar navigation</span>
                <kbd className="rounded border bg-background px-2 py-0.5 font-mono text-[10px]">Sidebar icon</kbd>
              </div>
              <div className="flex items-center justify-between border rounded p-2 bg-muted/20">
                <span>Close modal / Cancel form</span>
                <kbd className="rounded border bg-background px-2 py-0.5 font-mono text-[10px]">Esc</kbd>
              </div>
            </div>
          </div>
        ),
      },
    ],
    [onNavigate],
  );

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      const matchesCategory =
        selectedCategory === "all" || topic.category === selectedCategory;

      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        topic.title.toLowerCase().includes(query) ||
        topic.summary.toLowerCase().includes(query) ||
        topic.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [topics, selectedCategory, search]);

  const activeTopic = useMemo(() => {
    const foundInFiltered = filteredTopics.find((t) => t.id === activeTopicId);
    if (foundInFiltered) return foundInFiltered;
    return filteredTopics[0] || topics[0];
  }, [filteredTopics, activeTopicId, topics]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    if (catId === "all") {
      setActiveTopicId("quick-start");
    } else {
      const firstInCat = topics.find((t) => t.category === catId);
      if (firstInCat) setActiveTopicId(firstInCat.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Search & Filter */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-900/10 via-indigo-900/5 to-transparent p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3 flex-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <BookOpen size={16} /> In-App Help &amp; Operations Documentation
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              How can we help you today?
            </h2>
            <p className="text-sm text-muted-foreground">
              Search comprehensive guides for every module, workflow, role, and shortcut in Mobile Shop Desktop ERP.
            </p>
            <div className="relative pt-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guides (e.g., barcode, cash register, job card, udhaar, IMEI, backup)..."
                className="pl-10 h-11 bg-background text-sm shadow-sm"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                  onClick={() => setSearch("")}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <div className="hidden lg:flex shrink-0 items-center justify-center">
            <img
              src="/logo.png"
              alt="Mobile Shop ERP"
              className="size-20 rounded-2xl shadow-xl ring-1 ring-border/60 object-cover"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 pb-1">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-1.5 whitespace-nowrap text-xs h-8"
            onClick={() => handleSelectCategory(cat.id)}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </Button>
        ))}
      </div>

      {/* Main 2-Column Documentation Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Topic List */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider flex justify-between items-center">
            <span>Topics ({filteredTopics.length})</span>
            {search && <span className="text-primary font-normal">Filtered</span>}
          </div>

          <div className="space-y-1.5 max-h-[650px] overflow-y-auto pr-1">
            {filteredTopics.length > 0 ? (
              filteredTopics.map((topic) => {
                const isActive = topic.id === activeTopic.id;
                return (
                  <button
                    key={topic.id}
                    onClick={() => setActiveTopicId(topic.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/60 hover:bg-muted/50 hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-sm font-semibold leading-snug ${
                          isActive ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {topic.title}
                      </h4>
                      {topic.badge && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {topic.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {topic.summary}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center border rounded-lg bg-muted/20 text-muted-foreground text-xs">
                No guides matching "{search}". Try searching for <em>barcode</em>, <em>repair</em>, or <em>cash</em>.
              </div>
            )}
          </div>
        </div>

        {/* Selected Topic Content Display */}
        <div className="lg:col-span-8">
          <Card className="shadow-sm">
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Documentation Article
                  </span>
                  <CardTitle className="text-xl mt-1">{activeTopic.title}</CardTitle>
                </div>
                {activeTopic.badge && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {activeTopic.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{activeTopic.summary}</p>
            </CardHeader>
            <CardContent className="pt-6">
              {activeTopic.content}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
