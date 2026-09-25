import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import JsBarcode from "jsbarcode";
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  HardDrive,
  HelpCircle,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  PanelLeft,
  PanelLeftClose,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { HelpCenter } from "./components/help/HelpCenter";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { PageHeader } from "./components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { SearchSelect } from "./components/ui/search-select";
import { ReportCharts } from "./components/reports/ReportCharts";
import { UpdateCenter } from "./components/updates/UpdateCenter";
import { saveInvoicePdf, saveRepairPdf } from "./lib/pdf";
import { formatDateTime } from "./lib/utils";
import {
  DEFAULT_SHOP_SETTINGS,
  GlobalSettings,
  normalizeShopSettings,
  ShopLogo,
  type ShopSettings,
} from "./components/settings/GlobalSettings";

type Row = Record<string, unknown>;
type User = { id: number; name: string; role: string };
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  source?: string;
  required?: boolean;
};
type Module = {
  title: string;
  description: string;
  path: string;
  role?: string;
  fields?: Field[];
  columns: string[];
  icon: ReactNode;
};
const roleLevel: Record<string, number> = {
  owner: 5,
  manager: 4,
  cashier: 3,
  salesman: 2,
  technician: 1,
};
const categories = [
  "phone",
  "charger",
  "cable",
  "handsfree",
  "cover",
  "glass",
  "power_bank",
  "smart_watch",
  "memory_card",
  "spare_part",
  "other",
];
const paymentMethods = [
  "cash",
  "card",
  "bank_transfer",
  "easypaisa",
  "jazzcash",
];
const conditionChecks = [
  { key: "screen", label: "Screen" },
  { key: "touch", label: "Touch" },
  { key: "camera", label: "Camera" },
  { key: "mic", label: "Microphone" },
  { key: "speaker", label: "Speaker" },
  { key: "charging", label: "Charging" },
  { key: "network", label: "Network" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "bluetooth", label: "Bluetooth" },
  { key: "battery", label: "Battery" },
  { key: "biometric", label: "Biometrics" },
  { key: "repaired_opened", label: "Previously repaired/opened" },
];
const checklistFrom = (values: Row, prefix = "") =>
  Object.fromEntries(
    conditionChecks.map(({ key }) => [key, values[`${prefix}${key}`] ?? ""]),
  );
const modules: Record<string, Module> = {
  dashboard: {
    title: "Dashboard",
    description: "Daily trading and stock health",
    path: "dashboard",
    columns: [],
    icon: <LayoutDashboard />,
  },
  products: {
    title: "Products & stock",
    description: "Mobiles, chargers, glass and accessories",
    path: "products",
    role: "manager",
    columns: [
      "name",
      "category",
      "sku",
      "price",
      "quantity",
      "phone_quantity",
      "reorder_level",
    ],
    icon: <Boxes />,
    fields: [
      { key: "name", label: "Product name", required: true },
      {
        key: "category",
        label: "Category",
        options: categories,
        required: true,
      },
      { key: "sku", label: "SKU" },
      { key: "barcode", label: "Barcode" },
      { key: "brand", label: "Brand" },
      { key: "model", label: "Model" },
      { key: "variant", label: "Variant" },
      { key: "color", label: "Color" },
      { key: "storage", label: "Storage" },
      {
        key: "condition",
        label: "Condition",
        options: ["box_pack", "open_box", "kit", "used", "refurbished"],
      },
      { key: "compatible_models", label: "Compatible models" },
      { key: "cost", label: "Cost", type: "number" },
      { key: "price", label: "Sale price", type: "number" },
      { key: "min_price", label: "Minimum price", type: "number" },
      { key: "reorder_level", label: "Reorder level", type: "number" },
      { key: "warranty_days", label: "Warranty days", type: "number" },
    ],
  },
  phones: {
    title: "IMEI stock",
    description: "Individually tracked phones and trade-ins",
    path: "phones",
    columns: [
      "id",
      "product_name",
      "imei1",
      "imei2",
      "pta_status",
      "condition_grade",
      "status",
      "purchase_cost",
    ],
    icon: <Smartphone />,
  },
  purchases: {
    title: "Purchases",
    description: "Receive phones and accessory stock",
    path: "purchases",
    role: "manager",
    columns: ["id", "supplier", "reference", "total", "paid", "date"],
    icon: <PackagePlus />,
  },
  used: {
    title: "Used phone buys",
    description: "Customer trade-in and used phone purchases",
    path: "used-purchases",
    role: "manager",
    columns: ["id", "seller", "product_name", "imei1", "agreed_price", "paid"],
    icon: <ShoppingBag />,
  },
  sales: {
    title: "Sales & invoices",
    description: "Retail checkout and invoices",
    path: "sales",
    columns: ["id", "invoice_no", "customer", "total", "paid", "date"],
    icon: <ReceiptText />,
  },
  installments: {
    title: "Installments",
    description: "Track due and paid installments",
    path: "installments",
    role: "cashier",
    columns: ["invoice_no", "customer", "due_date", "amount", "paid"],
    icon: <CalendarClock />,
  },
  repairs: {
    title: "Repair jobs",
    description: "Customer handoff and spare parts",
    path: "repairs",
    columns: [
      "id",
      "job_no",
      "customer",
      "model",
      "fault",
      "status",
      "labor_charge",
      "paid",
    ],
    icon: <Wrench />,
    fields: [
      {
        key: "customer_id",
        label: "Customer",
        source: "customer",
        required: true,
      },
      { key: "model", label: "Model", required: true },
      { key: "imei", label: "IMEI" },
      { key: "fault", label: "Fault", required: true },
      { key: "condition_notes", label: "Condition notes" },
      { key: "received_accessories", label: "Received accessories" },
      { key: "expected_date", label: "Expected date", type: "date" },
      { key: "technician_id", label: "Technician", source: "technician" },
      { key: "labor_charge", label: "Labor charge", type: "number" },
      { key: "other_cost", label: "Technician/other cost", type: "number" },
    ],
  },
  warranties: {
    title: "Warranty claims",
    description: "Track post-sale claims",
    path: "warranties",
    columns: [
      "id",
      "invoice_no",
      "imei1",
      "issue",
      "expiry_date",
      "status",
      "action",
    ],
    icon: <ShieldCheck />,
    fields: [
      { key: "sale_id", label: "Sale ID", type: "number", required: true },
      { key: "phone_id", label: "Phone ID", type: "number" },
      { key: "issue", label: "Issue", required: true },
      { key: "action", label: "Action" },
    ],
  },
  customers: {
    title: "Customers",
    description: "Customer records and balances",
    path: "contacts?kind=customer",
    columns: ["name", "phone", "address", "created_at"],
    icon: <Users />,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "notes", label: "Notes" },
    ],
  },
  suppliers: {
    title: "Suppliers",
    description: "Vendors and purchase balances",
    path: "contacts?kind=supplier",
    role: "manager",
    columns: ["name", "phone", "address", "created_at"],
    icon: <Truck />,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "notes", label: "Notes" },
    ],
  },
  ledger: {
    title: "Customer & supplier ledger",
    description: "Balances and transaction history",
    path: "ledger",
    columns: [],
    icon: <ClipboardList />,
  },
  payments: {
    title: "Payments",
    description: "Record outstanding sale, purchase, and repair payments",
    path: "payments",
    role: "cashier",
    columns: [
      "date",
      "direction",
      "contact_name",
      "sale_id",
      "purchase_id",
      "repair_id",
      "method",
      "amount",
    ],
    icon: <CircleDollarSign />,
    fields: [
      { key: "sale_id", label: "Sale ID", type: "number" },
      { key: "purchase_id", label: "Purchase ID", type: "number" },
      { key: "repair_id", label: "Repair ID", type: "number" },
      { key: "amount", label: "Amount", type: "number", required: true },
      {
        key: "method",
        label: "Method",
        options: paymentMethods,
        required: true,
      },
      { key: "notes", label: "Notes" },
    ],
  },
  expenses: {
    title: "Expenses",
    description: "Shop operating costs",
    path: "expenses",
    role: "cashier",
    columns: ["category", "description", "amount", "method", "date"],
    icon: <CircleDollarSign />,
    fields: [
      { key: "category", label: "Category", required: true },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "method", label: "Method", options: paymentMethods },
    ],
  },
  drawings: {
    title: "Owner drawings",
    description: "Cash withdrawn by owner",
    path: "drawings",
    role: "owner",
    columns: ["amount", "notes", "date"],
    icon: <CircleDollarSign />,
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "notes", label: "Notes" },
    ],
  },
  cash: {
    title: "Cash register",
    description: "Open and reconcile cash sessions",
    path: "cash",
    role: "cashier",
    columns: [
      "id",
      "opening",
      "expected_closing",
      "actual_closing",
      "opened_at",
      "closed_at",
    ],
    icon: <CircleDollarSign />,
  },
  rates: {
    title: "Market rates",
    description: "Current buy and sell references",
    path: "market-rates",
    columns: ["name", "buy_rate", "sell_rate", "date"],
    icon: <Activity />,
    fields: [
      {
        key: "product_id",
        label: "Product",
        source: "products",
        required: true,
      },
      { key: "buy_rate", label: "Buy rate", type: "number", required: true },
      { key: "sell_rate", label: "Sell rate", type: "number", required: true },
    ],
  },
  priceHistory: {
    title: "Price history",
    description: "Product cost and selling price changes",
    path: "price-history",
    role: "manager",
    columns: [
      "date",
      "product_name",
      "old_cost",
      "new_cost",
      "old_price",
      "new_price",
      "changed_by_name",
    ],
    icon: <History />,
  },
  reports: {
    title: "Reports",
    description: "Revenue, margin, stock and staff",
    path: "reports",
    role: "manager",
    columns: [],
    icon: <BarChart3 />,
  },
  history: {
    title: "IMEI history",
    description: "Every movement for a phone",
    path: "phone-history",
    columns: [],
    icon: <History />,
  },
  search: {
    title: "Search",
    description: "Search stock, IMEIs and invoices",
    path: "search",
    columns: [],
    icon: <Search />,
  },
  users: {
    title: "Staff",
    description: "Roles and local accounts",
    path: "users",
    role: "manager",
    columns: ["name", "username", "role", "active"],
    icon: <Users />,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "username", label: "Username", required: true },
      { key: "password", label: "Password", type: "password", required: true },
      {
        key: "role",
        label: "Role",
        options: ["manager", "cashier", "salesman", "technician"],
        required: true,
      },
    ],
  },
  branches: {
    title: "Branches",
    description: "Shop locations",
    path: "branches",
    role: "owner",
    columns: ["name", "address", "phone"],
    icon: <Building2 />,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "address", label: "Address" },
      { key: "phone", label: "Phone" },
    ],
  },
  backup: {
    title: "Backup & restore",
    description: "Local database snapshots",
    path: "backup",
    role: "owner",
    columns: [],
    icon: <HardDrive />,
  },
  settings: {
    title: "Global settings",
    description: "Shop identity, logo and receipt details",
    path: "settings",
    role: "owner",
    columns: [],
    icon: <Settings2 />,
  },
  audit: {
    title: "Audit trail",
    description: "Recorded staff actions",
    path: "audit",
    role: "owner",
    columns: ["date", "user_id", "action", "entity", "entity_id", "details"],
    icon: <FileClock />,
  },
  help: {
    title: "User Guide & Documentation",
    description: "In-depth interactive manual for every feature and module",
    path: "help",
    columns: [],
    icon: <BookOpen />,
  },
};
const menuGroups = [
  { title: "Overview", items: ["dashboard", "reports", "help"] },
  {
    title: "Inventory",
    items: ["products", "phones", "purchases", "used", "rates", "priceHistory"],
  },
  {
    title: "Sales & customers",
    items: ["sales", "installments", "customers", "ledger", "payments"],
  },
  { title: "Workshop", items: ["repairs", "warranties"] },
  { title: "Finance", items: ["suppliers", "expenses", "drawings", "cash"] },
  {
    title: "Management",
    items: ["history", "search", "users", "branches", "settings", "backup", "audit"],
  },
];
async function api<T = unknown>(
  method: string,
  path: string,
  data: Row = {},
  token = "",
): Promise<T> {
  try {
    return await invoke<T>("api_request", {
      method,
      path: `/api/${path}`,
      data,
      token,
    });
  } catch (e) {
    const msg = typeof e === "string" ? e : JSON.stringify(e);
    throw new Error(msg.replace(/^Error:\s*/, ""));
  }
}
const money = (n: unknown) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
const text = (v: unknown) => (v == null ? "—" : String(v));
const fieldValue = (f: Field, value: unknown) =>
  f.type === "checkbox"
    ? Boolean(value)
    : f.type === "number"
      ? Number(value) || 0
      : String(value ?? "");
const barcodeValue = (product: Row) => {
  const value = String(product.barcode || product.sku || "").trim();
  return /^[\x20-\x7e]+$/.test(value) ? value : "";
};
function FormFields({
  fields,
  value,
  setValue,
  lookups,
}: {
  fields: Field[];
  value: Row;
  setValue: (x: Row) => void;
  lookups: Record<string, Row[]>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}</Label>
          {f.type === "checkbox" ? (
            <input
              id={f.key}
              type="checkbox"
              checked={Boolean(value[f.key])}
              onChange={(e) =>
                setValue({ ...value, [f.key]: e.target.checked })
              }
              className="size-4 rounded border"
            />
          ) : f.source ? (
            <SearchSelect
              id={f.key}
              required={f.required}
              value={String(value[f.key] ?? "")}
              onChange={(id) => setValue({ ...value, [f.key]: id })}
              placeholder={`Search ${f.label.toLowerCase()}`}
              options={(lookups[f.source] ?? []).map((option) => ({
                value: String(option.id),
                label: String(option.name ?? option.imei1 ?? option.id),
                description: [option.sku, option.category, option.phone]
                  .filter(Boolean)
                  .map(String)
                  .join(" · "),
                searchText: [
                  option.model,
                  option.barcode,
                  option.imei1,
                  option.imei2,
                ]
                  .filter(Boolean)
                  .map(String)
                  .join(" "),
              }))}
            />
          ) : f.options ? (
            <select
              id={f.key}
              required={f.required}
              value={text(value[f.key] == null ? "" : value[f.key])}
              onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
              className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
            >
              <option value="">Select {f.label.toLowerCase()}</option>
              {f.options.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={f.key}
              type={f.type ?? "text"}
              min={f.type === "number" ? 0 : undefined}
              step={f.type === "number" ? "0.01" : undefined}
              required={f.required}
              value={text(value[f.key] == null ? "" : value[f.key])}
              onChange={(e) => setValue({ ...value, [f.key]: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
function ProductEntryFields({
  fields,
  value,
  setValue,
  lookups,
}: {
  fields: Field[];
  value: Row;
  setValue: (x: Row) => void;
  lookups: Record<string, Row[]>;
}) {
  const group = (keys: string[]) =>
    fields.filter((field) => keys.includes(field.key));
  const isPhone = value.category === "phone";
  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
              1
            </span>
            Product identity
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose the stock category and enter the name customers will
            recognize.
          </p>
        </CardHeader>
        <CardContent>
          <FormFields
            fields={group(["name", "category", "brand", "sku", "barcode"])}
            value={value}
            setValue={setValue}
            lookups={lookups}
          />
        </CardContent>
      </Card>
      {value.category ? (
        <Card key={String(value.category)} className="entry-reveal">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                2
              </span>
              {isPhone ? (
                <Smartphone className="size-4 text-emerald-700" />
              ) : (
                <Boxes className="size-4 text-emerald-700" />
              )}
              {isPhone
                ? "Phone specifications"
                : "Item details & compatibility"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isPhone
                ? "Record the model and variant here. Each handset IMEI is added when stock arrives."
                : "Add the model and compatible phones so staff can find the right accessory."}
            </p>
          </CardHeader>
          <CardContent>
            <FormFields
              fields={group(
                isPhone
                  ? ["model", "variant", "color", "storage", "condition"]
                  : [
                      "model",
                      "variant",
                      "color",
                      "storage",
                      "condition",
                      "compatible_models",
                    ],
              )}
              value={value}
              setValue={setValue}
              lookups={lookups}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Select a category to reveal its details.
        </div>
      )}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
              3
            </span>
            Pricing & stock alerts
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set selling limits and the quantity that should trigger a reorder
            alert.
          </p>
        </CardHeader>
        <CardContent>
          <FormFields
            fields={group([
              "cost",
              "price",
              "min_price",
              "reorder_level",
              "warranty_days",
            ])}
            value={value}
            setValue={setValue}
            lookups={lookups}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function formatAuditDetails(action: string, entity: string, details: unknown): string {
  if (details == null || details === "" || details === "{}") return "—";
  let obj: Record<string, unknown> = {};
  if (typeof details === "string") {
    try {
      obj = JSON.parse(details);
    } catch {
      return details;
    }
  } else if (typeof details === "object") {
    obj = details as Record<string, unknown>;
  } else {
    return String(details);
  }

  if (Object.keys(obj).length === 0) return "—";

  if (action === "restore" && obj.name) {
    return `Restored from ${obj.name}${obj.safety ? ` (safety: ${obj.safety})` : ""}`;
  }
  if (action === "update" && entity === "shop_settings") {
    const parts = [];
    if (obj.shop_name) parts.push(`Shop: ${obj.shop_name}`);
    if (obj.logo_changed) parts.push("Logo updated");
    return parts.length ? parts.join(", ") : "Updated shop settings";
  }
  if (action === "update" && entity === "repair") {
    if (obj.status) {
      return `Status changed to ${obj.status}${obj.labor_charge != null ? ` (Labor: Rs ${obj.labor_charge})` : ""}`;
    }
    const changes = Object.entries(obj).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(", ");
    return changes || "Updated repair";
  }
  if (action === "consume_part") {
    return `Consumed spare part (qty: ${obj.qty ?? 1})`;
  }
  if (action === "create" && entity === "payment") {
    return `Payment recorded: ${money(obj.amount)}${obj.method ? ` via ${obj.method}` : ""}`;
  }
  if (action === "create" && entity === "used_purchase") {
    return `Purchased used phone (ID #${obj.phone || "—"})`;
  }
  if (action === "return" && entity === "sale") {
    return `Customer return recorded (refund: ${money(obj.refund)}, qty: ${obj.quantity ?? 1})`;
  }
  if (action === "update" && entity === "backup_preferences") {
    return `Backup schedule: ${obj.enabled ? `every ${obj.interval_hours}h` : "disabled"}`;
  }
  if (action === "open" && entity === "cash") {
    return "Opened cash register";
  }
  if (action === "close" && entity === "cash") {
    return `Closed cash register (expected: ${money(obj.expected)})`;
  }
  if (action === "create") {
    return `Created ${entity.replace("_", " ")}`;
  }
  if (action === "update" && entity === "product") {
    const fields = Object.keys(obj).filter(k => k !== "id");
    return fields.length ? `Updated ${fields.join(", ")}` : "Updated product";
  }

  return Object.entries(obj)
    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("; ");
}

function Grid({
  rows,
  columns,
  onPick,
}: {
  rows: Row[];
  columns: string[];
  onPick?: (r: Row) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c.replaceAll("_", " ")}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((r, i) => (
                <TableRow
                  key={String(r.id ?? i)}
                  onClick={() => onPick?.(r)}
                  className={onPick ? "cursor-pointer" : ""}
                >
                  {columns.map((c) => (
                    <TableCell key={c}>
                      {c === "status" ? (
                        <Badge
                          variant={
                            [
                              "available",
                              "completed",
                              "Ready",
                              "resolved",
                            ].includes(String(r[c]))
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {text(r[c])}
                        </Badge>
                      ) : c === "details" ? (
                        <span title={typeof r[c] === "string" ? r[c] : JSON.stringify(r[c])}>
                          {formatAuditDetails(String(r.action ?? ""), String(r.entity ?? ""), r[c])}
                        </span>
                      ) : [
                          "price",
                          "cost",
                          "total",
                          "paid",
                          "amount",
                          "buy_rate",
                          "sell_rate",
                          "opening",
                          "expected_closing",
                          "actual_closing",
                          "purchase_cost",
                          "labor_charge",
                          "old_cost",
                          "new_cost",
                          "old_price",
                          "new_price",
                        ].includes(c) ? (
                        money(r[c])
                      ) : [
                          "date",
                          "created_at",
                          "opened_at",
                          "closed_at",
                          "paid_at",
                          "delivered_at",
                          "updated_at",
                          "day",
                        ].includes(c) ? (
                        formatDateTime(r[c])
                      ) : (
                        text(r[c])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  No records yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
function App() {
  const [status, setStatus] = useState<"loading" | "setup" | "login" | "ready">(
    "loading",
  );
  const [token, setToken] = useState(localStorage.getItem("shop-token") ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [section, setSection] = useState("dashboard");
  const [rows, setRows] = useState<Row[]>([]);
  const [data, setData] = useState<Row>({});
  const [form, setForm] = useState<Row>({});
  const [lookups, setLookups] = useState<Record<string, Row[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [lines, setLines] = useState<Row[]>([]);
  const [line, setLine] = useState<Row>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [openGroups, setOpenGroups] = useState<string[]>(
    menuGroups.map((group) => group.title),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("shop-sidebar-collapsed") === "true",
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (!passwordForm.current_password) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await request("POST", "change-password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordSuccess("Password updated successfully!");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess("");
      }, 1500);
    } catch (err: unknown) {
      setPasswordError(
        typeof err === "string"
          ? err
          : (err as Error)?.message || "Failed to update password",
      );
    } finally {
      setPasswordBusy(false);
    }
  };
  const toggleSidebar = () =>
    setSidebarCollapsed((collapsed) => {
      localStorage.setItem("shop-sidebar-collapsed", String(!collapsed));
      return !collapsed;
    });
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const loadEpoch = useRef(0);
  const request = useCallback(
    <T,>(method: string, path: string, body: Row = {}) =>
      api<T>(method, path, body, token),
    [token],
  );
  const load = useCallback(async () => {
    if (status !== "ready") return;
    if (sectionRef.current !== section) return;
    const epoch = ++loadEpoch.current;
    setError("");
    setSelected(null);
    try {
      const m = modules[section];
      const result = ["ledger", "history", "search", "help"].includes(section)
        ? {}
        : await request<unknown>("GET", m.path);
      if (epoch !== loadEpoch.current || sectionRef.current !== section) return;
      if (Array.isArray(result)) {
        setRows(result as Row[]);
        setData({});
      } else {
        setData(result as Row);
        setRows([]);
        if (section === "settings") setSettings(normalizeShopSettings(result));
      }
      if (section === "installments") {
        const sales = await request<Row[]>("GET", "sales");
        if (epoch !== loadEpoch.current || sectionRef.current !== section)
          return;
        setLookups({ sales });
      }
      if (
        [
          "ledger",
          "products",
          "purchases",
          "sales",
          "used",
          "repairs",
          "rates",
          "warranties",
          "customers",
          "suppliers",
        ].includes(section)
      ) {
        const [products, phones, customers, suppliers, staff] =
          await Promise.all([
            request<Row[]>("GET", "products"),
            request<Row[]>("GET", "phones"),
            request<Row[]>("GET", "contacts?kind=customer"),
            request<Row[]>("GET", "contacts?kind=supplier"),
            section === "repairs" && user && roleLevel[user.role] >= 4
              ? request<Row[]>("GET", "users")
              : Promise.resolve([]),
          ]);
        if (epoch !== loadEpoch.current || sectionRef.current !== section)
          return;
        setLookups({
          products,
          phones,
          customer: customers,
          supplier: suppliers,
          technician: staff.filter((person) => person.role === "technician"),
        });
      }
    } catch (e) {
      if (epoch === loadEpoch.current && sectionRef.current === section)
        setError(String(e));
    }
  }, [request, section, status, user]);
  useEffect(() => {
    api<Row>("GET", "status")
      .then(async (r) => {
        if (r.branding) setSettings((current) => ({ ...current, ...normalizeShopSettings(r.branding) }));
        if (r.setup) {
          setStatus("setup");
          return;
        }
        if (token) {
          try {
            const u = await api<User>("GET", "me", {}, token);
            setUser(u);
            setStatus("ready");
            return;
          } catch {
            localStorage.removeItem("shop-token");
            setToken("");
          }
        }
        setStatus("login");
      })
      .catch((e) => {
        setError(String(e));
        setStatus("login");
      });
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (status !== "ready") return;
    request<Row>("GET", "settings")
      .then((value) => setSettings(normalizeShopSettings(value)))
      .catch(() => {});
  }, [request, status]);
  const submitAuth = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (status === "setup") {
        await api("POST", "setup", form);
        setStatus("login");
        setForm({});
      } else {
        const r = await api<{ token: string; user: User }>(
          "POST",
          "login",
          form,
        );
        localStorage.setItem("shop-token", r.token);
        setToken(r.token);
        setUser(r.user);
        setStatus("ready");
        setForm({});
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (path: string, body: Row, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      await request(method, path, body);
      setShowForm(false);
      setForm({});
      setLines([]);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const saveSettings = async (next: ShopSettings) => {
    const saved = normalizeShopSettings(await request<Row>("PUT", "settings", next));
    setSettings(saved);
    return saved;
  };
  const logout = async () => {
    try {
      await request("POST", "logout");
    } catch {}
    localStorage.removeItem("shop-token");
    setToken("");
    setUser(null);
    setStatus("login");
  };
  if (status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading shop database…
      </div>
    );
  if (status !== "ready")
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <ShopLogo settings={settings} className="mb-3 size-12" />
            <CardTitle className="text-2xl">{settings.shop_name}</CardTitle>
            {settings.tagline && <p className="text-xs text-muted-foreground">{settings.tagline}</p>}
            <p className="text-sm text-muted-foreground">
              {status === "setup"
                ? "Create the local owner account"
                : "Sign in to your desktop shop"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitAuth} className="space-y-4">
              {status === "setup" && (
                <div>
                  <Label htmlFor="owner-name">Name</Label>
                  <Input
                    id="owner-name"
                    required
                    value={text(form.name ?? "")}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="auth-username">Username</Label>
                <Input
                  id="auth-username"
                  required
                  autoFocus
                  value={text(form.username ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  required
                  type="password"
                  minLength={status === "setup" ? 8 : undefined}
                  value={text(form.password ?? "")}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <Button disabled={busy} className="w-full" type="submit">
                {status === "setup" ? "Create shop" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  const m = modules[section];
  const allowed = (x: Module) =>
    !x.role || (user && roleLevel[user.role] >= roleLevel[x.role]);
  const simple = [
    "products",
    "customers",
    "suppliers",
    "repairs",
    "warranties",
    "expenses",
    "rates",
    "users",
    "branches",
    "payments",
    "drawings",
  ];
  const createGeneric = (e: FormEvent) => {
    e.preventDefault();
    const fields = m.fields ?? [];
    const body = Object.fromEntries(
      fields.map((f) => [f.key, fieldValue(f, form[f.key])]),
    ) as Row;
    if (section === "customers") body.kind = "customer";
    if (section === "suppliers") body.kind = "supplier";
    void submit(m.path.split("?")[0], body);
  };
  const navigate = (key: string) => {
    setSection(key);
    setRows([]);
    setSelected(null);
    const group = menuGroups.find((item) => item.items.includes(key));
    if (group)
      setOpenGroups((current) =>
        current.includes(group.title) ? current : [...current, group.title],
      );
    setShowForm(false);
    setError("");
    setForm({});
    setLines([]);
  };
  return (
    <div id="shop-app-shell" className="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
      <aside
        data-testid="shop-sidebar"
        data-collapsed={sidebarCollapsed}
        className={`shop-sidebar flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
          sidebarCollapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center px-4 border-b border-border/40 overflow-hidden">
          <ShopLogo settings={settings} className="size-8 rounded-lg shadow-xs ring-1 ring-emerald-500/30 shrink-0" />
          <div
            className={`min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
              sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            aria-hidden={sidebarCollapsed}
          >
            <div className="text-sm font-bold tracking-tight text-foreground truncate">{settings.shop_name}</div>
            <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1.5 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{settings.tagline || "Enterprise ERP"}</span>
            </div>
          </div>
        </div>
        <nav
          aria-label="Shop modules"
          className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-3 px-2"
        >
          {menuGroups.map((group) => {
            const items = group.items.filter((key) => allowed(modules[key]));
            if (!items.length) return null;
            const open = sidebarCollapsed || openGroups.includes(group.title);
            return (
              <div key={group.title} className="menu-group">
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    sidebarCollapsed ? "h-0 opacity-0 my-0 pointer-events-none" : "h-6 opacity-100 mt-2 mb-0.5"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`menu-${group.title.replaceAll(" ", "-")}`}
                    onClick={() =>
                      setOpenGroups((current) =>
                        open
                          ? current.filter((name) => name !== group.title)
                          : [...current, group.title],
                      )
                    }
                    className="group flex w-full items-center justify-between px-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground select-none cursor-pointer"
                  >
                    <span className="truncate">{group.title}</span>
                    <ChevronDown
                      className={`size-3 text-muted-foreground/40 transition-transform duration-200 group-hover:text-foreground shrink-0 ${
                        open ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                </div>
                <div
                  className={`transition-all duration-200 ${
                    sidebarCollapsed ? "my-1.5 mx-auto h-px w-6 bg-border/40 opacity-100" : "h-0 opacity-0 overflow-hidden my-0"
                  }`}
                  aria-hidden="true"
                />
                <div
                  id={`menu-${group.title.replaceAll(" ", "-")}`}
                  aria-hidden={!open}
                  className={`menu-group-content ${open ? "is-open" : ""}`}
                >
                  <div className="min-h-0 overflow-hidden space-y-0.5 pt-0.5">
                    {items.map((key) => {
                      const x = modules[key];
                      const active = section === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          tabIndex={open ? 0 : -1}
                          title={x.title}
                          aria-label={x.title}
                          aria-current={active ? "page" : undefined}
                          onClick={() => navigate(key)}
                          className={`group relative flex h-9 w-full items-center rounded-lg text-left text-xs transition-colors duration-150 cursor-pointer overflow-hidden px-2 ${
                            active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500/25 shadow-2xs"
                              : "text-muted-foreground font-medium hover:bg-muted/70 hover:text-foreground"
                          }`}
                        >
                          <div className="size-8 shrink-0 flex items-center justify-center">
                            <span
                              className={`transition-colors [&>svg]:size-[18px] ${
                                active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/80 group-hover:text-foreground"
                              }`}
                              aria-hidden="true"
                            >
                              {x.icon}
                            </span>
                          </div>
                          <div
                            className={`min-w-0 flex-1 ml-2 overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
                              sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
                            }`}
                          >
                            <span className="truncate block">{x.title}</span>
                          </div>
                          {!sidebarCollapsed && active && (
                            <span className="ml-auto size-1.5 rounded-full bg-emerald-500 shrink-0 shadow-xs mr-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border/40 p-2">
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="group relative flex h-9 w-full items-center rounded-lg text-left text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground px-2 transition-colors cursor-pointer"
          >
            <div className="size-8 shrink-0 flex items-center justify-center">
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </div>
            <div
              className={`min-w-0 flex-1 ml-2 overflow-hidden whitespace-nowrap transition-opacity duration-200 ${
                sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <span className="truncate block">{sidebarCollapsed ? "Expand" : "Collapse"}</span>
            </div>
          </Button>
        </div>
      </aside>
      <main className="shop-content-scroll h-full min-h-0 min-w-0 flex-1 overflow-y-auto">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
              className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </Button>
            <span className="h-4 border-l" aria-hidden="true" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <HardDrive size={13} className="text-muted-foreground/70" />
              <span>Local desktop database</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              onClick={() => setSection("help")}
            >
              <HelpCircle size={14} className="text-primary" />
              <span>Help & Docs</span>
            </Button>
            <div
              title="Main Store · POS Terminal (Identifies the active retail counter/station)"
              className="hidden sm:flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-2xs font-medium cursor-default select-none"
            >
              <span className="size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
              <span className="text-foreground font-semibold">Main Store</span>
              <span className="text-[11px] text-muted-foreground font-medium">· POS Terminal</span>
            </div>
            {user && (
              <div className="relative pl-1">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1.5 pr-2.5 text-xs shadow-2xs hover:bg-accent hover:border-border transition-all cursor-pointer"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-2xs">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex flex-col text-left leading-none">
                    <span className="font-semibold text-foreground text-xs leading-none">
                      {user.name}
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground leading-none mt-0.5">
                      {user.role}
                    </span>
                  </div>
                  <ChevronDown
                    size={12}
                    className={`text-muted-foreground transition-transform duration-200 ${
                      userMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-lg backdrop-blur-md">
                      <div className="px-2.5 py-2 border-b border-border/60">
                        <p className="text-xs font-semibold text-foreground">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Role: <span className="font-medium text-foreground capitalize">{user.role}</span>
                        </p>
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setPasswordError("");
                            setPasswordSuccess("");
                            setPasswordForm({
                              current_password: "",
                              new_password: "",
                              confirm_password: "",
                            });
                            setPasswordModalOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                        >
                          <KeyRound size={14} className="text-muted-foreground" />
                          <span>Change Password</span>
                        </button>
                        {user.role === "owner" && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserMenuOpen(false);
                              setSection("settings");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                          >
                            <Settings2 size={14} className="text-muted-foreground" />
                            <span>Global Settings</span>
                          </button>
                        )}
                        {(user.role === "owner" || user.role === "manager") && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserMenuOpen(false);
                              setSection("users");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                          >
                            <Users size={14} className="text-muted-foreground" />
                            <span>Staff Accounts</span>
                          </button>
                        )}
                      </div>

                      <div className="border-t border-border/60 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setLogoutModalOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
                        >
                          <LogOut size={14} />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {logoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <LogOut size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base">Confirm Sign Out</h3>
                  <p className="text-xs text-muted-foreground">Session Termination</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to sign out of <strong>{settings.shop_name}</strong>? Any unsaved edits will be discarded.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLogoutModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setLogoutModalOpen(false);
                    logout();
                  }}
                >
                  Confirm Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}

        {passwordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in-0">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <KeyRound size={18} className="text-primary" />
                  <span>Change Password</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passwordError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    {passwordSuccess}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="current-pwd" className="text-xs font-medium text-foreground">
                    Current Password
                  </label>
                  <Input
                    id="current-pwd"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, current_password: e.target.value })
                    }
                    placeholder="Enter current password"
                    required
                    disabled={passwordBusy}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-pwd" className="text-xs font-medium text-foreground">
                    New Password
                  </label>
                  <Input
                    id="new-pwd"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new_password: e.target.value })
                    }
                    placeholder="Minimum 8 characters"
                    required
                    disabled={passwordBusy}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-pwd" className="text-xs font-medium text-foreground">
                    Confirm New Password
                  </label>
                  <Input
                    id="confirm-pwd"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                    }
                    placeholder="Re-enter new password"
                    required
                    disabled={passwordBusy}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPasswordModalOpen(false)}
                    disabled={passwordBusy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={passwordBusy}>
                    {passwordBusy ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        <UpdateCenter />
        <div key={section} className="page-enter mx-auto max-w-7xl p-8">
          <PageHeader
            title={m.title}
            description={m.description}
            action={
              section === "help" ? null : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void load()}>
                    Refresh
                  </Button>
                  {((simple.includes(section) &&
                    (!["products", "rates"].includes(section) ||
                      (user && roleLevel[user.role] >= 4)) &&
                    (section !== "users" || user?.role === "owner")) ||
                    ["purchases", "sales", "used"].includes(section)) && (
                    <Button
                      onClick={() => {
                        setShowForm(!showForm);
                        setForm({});
                        setLines([]);
                      }}
                    >
                      Add new
                    </Button>
                  )}
                </div>
              )
            }
          />
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {showForm && simple.includes(section) && (
            <Card className="entry-reveal mb-6">
              <CardHeader>
                <CardTitle>New {m.title.toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createGeneric} className="space-y-5">
                  {section === "products" ? (
                    <ProductEntryFields
                      fields={m.fields ?? []}
                      value={form}
                      setValue={setForm}
                      lookups={lookups}
                    />
                  ) : (
                    <FormFields
                      fields={m.fields ?? []}
                      value={form}
                      setValue={setForm}
                      lookups={lookups}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button disabled={busy} type="submit">
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          {section === "dashboard" && (
            <Dashboard data={data} onNavigate={navigate} />
          )}
          {section === "purchases" && showForm && (
            <TransactionForm
              kind="purchase"
              form={form}
              setForm={setForm}
              line={line}
              setLine={setLine}
              lines={lines}
              setLines={setLines}
              lookups={lookups}
              busy={busy}
              submit={submit}
            />
          )}
          {section === "sales" && showForm && (
            <TransactionForm
              kind="sale"
              form={form}
              setForm={setForm}
              line={line}
              setLine={setLine}
              lines={lines}
              setLines={setLines}
              lookups={lookups}
              busy={busy}
              submit={submit}
            />
          )}
          {section === "used" && showForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Buy used phone</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const checklist = checklistFrom(form);
                    void submit("used-purchases", { ...form, checklist });
                  }}
                  className="space-y-4"
                >
                  <FormFields
                    fields={[
                      {
                        key: "customer_id",
                        label: "Seller",
                        source: "customer",
                        required: true,
                      },
                      {
                        key: "product_id",
                        label: "Phone model",
                        source: "products",
                        required: true,
                      },
                      { key: "imei1", label: "IMEI 1", required: true },
                      { key: "imei2", label: "IMEI 2" },
                      {
                        key: "pta_status",
                        label: "PTA status",
                        options: [
                          "approved",
                          "non_approved",
                          "pending",
                          "unknown",
                        ],
                      },
                      { key: "condition_grade", label: "Condition grade" },
                      ...conditionChecks,
                      {
                        key: "box_included",
                        label: "Box included",
                        type: "checkbox",
                      },
                      {
                        key: "charger_included",
                        label: "Charger included",
                        type: "checkbox",
                      },
                      { key: "testing_notes", label: "Testing notes" },
                      {
                        key: "agreed_price",
                        label: "Agreed price",
                        type: "number",
                        required: true,
                      },
                      { key: "paid", label: "Paid", type: "number" },
                      {
                        key: "method",
                        label: "Payment method",
                        options: paymentMethods,
                      },
                    ]}
                    value={form}
                    setValue={setForm}
                    lookups={lookups}
                  />
                  <Button type="submit" disabled={busy}>
                    Save used phone
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
          {m.columns.length > 0 && (
            <Grid rows={rows} columns={m.columns} onPick={setSelected} />
          )}
          {selected && (
            <Details
              section={section}
              row={selected}
              request={request}
              submit={submit}
              lookups={lookups}
              busy={busy}
              settings={settings}
              canReturn={roleLevel[user?.role ?? ""] >= 4}
            />
          )}
          {section === "cash" && (
            <CashPanel rows={rows} submit={submit} request={request} busy={busy} />
          )}
          {section === "installments" && (
            <InstallmentPanel rows={rows} submit={submit} busy={busy} />
          )}
          {section === "reports" && (
            <Reports data={data} request={request} setError={setError} />
          )}
          {section === "help" && (
            <HelpCenter onNavigate={(sec) => setSection(sec)} />
          )}
          {section === "ledger" && (
            <LedgerPanel request={request} lookups={lookups} />
          )}
          {section === "installments" && (
            <SchedulePanel
              submit={submit}
              busy={busy}
              sales={lookups.sales ?? []}
              installments={rows}
            />
          )}
          {section === "backup" && (
            <BackupPanel
              rows={rows}
              request={request}
              refresh={load}
              setError={setError}
            />
          )}
          {section === "settings" && (
            <><GlobalSettings settings={settings} save={saveSettings} /><UpdatePanel /></>
          )}
          {section === "history" && (
            <SearchPanel
              kind="history"
              term={searchTerm}
              setTerm={setSearchTerm}
              request={request}
            />
          )}
          {section === "search" && (
            <SearchPanel
              kind="search"
              term={searchTerm}
              setTerm={setSearchTerm}
              request={request}
            />
          )}
        </div>
      </main>
    </div>
  );
}
function Dashboard({
  data,
  onNavigate,
}: {
  data: Row;
  onNavigate: (x: string) => void;
}) {
  const stats = [
    ["Sales today", "salesToday", "sales"],
    ["Sales this month", "salesMonth", "sales"],
    ["Receivables", "outstanding", "installments"],
    ["Phones available", "availablePhones", "phones"],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(([title, key, to]) => (
          <button
            key={key}
            type="button"
            className="rounded-xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            onClick={() => onNavigate(to)}
          >
            <Card className="h-full hover:border-emerald-300 hover:shadow-sm">
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">{title}</div>
                <div className="mt-2 text-2xl font-semibold">
                  {key === "availablePhones"
                    ? text(data[key] ?? 0)
                    : money(data[key])}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">Recent sales</h2>
          <Grid
            rows={
              Array.isArray(data.recentSales) ? (data.recentSales as Row[]) : []
            }
            columns={["invoice_no", "customer", "total", "paid", "date"]}
          />
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Low stock</h2>
          <Grid
            rows={Array.isArray(data.lowStock) ? (data.lowStock as Row[]) : []}
            columns={["name", "quantity", "reorder_level"]}
          />
          <Card className="mt-4">
            <CardContent className="flex justify-between p-5">
              <span>Ready repairs</span>
              <strong>{text(data.repairsReady ?? 0)}</strong>
            </CardContent>
          </Card>
          <Card className="mt-3">
            <CardContent className="flex justify-between p-5">
              <span>Overdue installments</span>
              <strong>{text(data.overdue ?? 0)}</strong>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
function TransactionForm({
  kind,
  form,
  setForm,
  line,
  setLine,
  lines,
  setLines,
  lookups,
  busy,
  submit,
}: {
  kind: "purchase" | "sale";
  form: Row;
  setForm: (x: Row) => void;
  line: Row;
  setLine: (x: Row) => void;
  lines: Row[];
  setLines: (x: Row[]) => void;
  lookups: Record<string, Row[]>;
  busy: boolean;
  submit: (path: string, body: Row) => Promise<void>;
}) {
  const isSale = kind === "sale";
  const [payments, setPayments] = useState<Row[]>([]);
  const [formError, setFormError] = useState("");
  const product = lookups.products?.find(
    (p) => String(p.id) === String(line.product_id),
  );
  const pickProduct = (picked: Row) => {
    setFormError("");
    setLine({
      product_id: String(picked.id),
      unit_price: picked.price,
      unit_cost: picked.cost,
      scan: "",
    });
  };
  const add = () => {
    if (!product) return;
    const phone = String(product.category) === "phone";
    if (phone && isSale && !line.phone_id) return;
    if (phone && !isSale) {
      const im1 = String(line.imei1 ?? "").trim();
      const im2 = String(line.imei2 ?? "").trim();
      if (!im1) {
        setFormError("IMEI 1 is required for handsets");
        return;
      }
      if (im1.length !== 15 || !/^\d+$/.test(im1)) {
        setFormError("IMEI 1 must contain exactly 15 digits");
        return;
      }
      if (im2 && (im2.length !== 15 || !/^\d+$/.test(im2))) {
        setFormError("IMEI 2 must contain exactly 15 digits");
        return;
      }
      if (im2 && im1 === im2) {
        setFormError("IMEI 1 and IMEI 2 must differ");
        return;
      }
      const existing = lookups.phones?.find(
        (p) => p.imei1 === im1 || p.imei2 === im1 || (im2 && (p.imei1 === im2 || p.imei2 === im2)),
      );
      if (existing) {
        const dup = (existing.imei1 === im1 || existing.imei2 === im1) ? im1 : im2;
        setFormError(`IMEI already exists in inventory: ${dup}`);
        return;
      }
      const inCurrentLines = lines.some((l) =>
        (l.imeis as Row[])?.some((h) => h.imei1 === im1 || h.imei2 === im1 || (im2 && (h.imei1 === im2 || h.imei2 === im2))),
      );
      if (inCurrentLines) {
        setFormError(`IMEI already added to this purchase: ${im1}`);
        return;
      }
    }
    setFormError("");
    setLines([
      ...lines,
      phone && !isSale
        ? {
            product_id: Number(product.id),
            unit_cost: Number(line.unit_cost),
            imeis: [
              {
                imei1: String(line.imei1),
                imei2: String(line.imei2 ?? ""),
                pta_status: String(line.pta_status ?? "unknown"),
                condition_grade: String(line.condition_grade ?? ""),
                checklist: checklistFrom(line),
                box_included: Boolean(line.box_included),
                charger_included: Boolean(line.charger_included),
              },
            ],
          }
        : {
            product_id: Number(product.id),
            phone_id: phone ? Number(line.phone_id) : undefined,
            quantity: phone ? 1 : Number(line.quantity) || 1,
            [isSale ? "unit_price" : "unit_cost"]: Number(
              line[isSale ? "unit_price" : "unit_cost"],
            ),
          },
    ]);
    setLine({});
  };
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{isSale ? "New sale" : "Receive stock"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {formError}
          </div>
        )}
        <FormFields
          fields={
            isSale
              ? [
                  { key: "customer_id", label: "Customer", source: "customer" },
                  { key: "discount", label: "Discount", type: "number" },
                  {
                    key: "trade_in_value",
                    label: "Trade-in value",
                    type: "number",
                  },
                  {
                    key: "trade_product_id",
                    label: "Trade-in model",
                    source: "products",
                  },
                  { key: "trade_imei1", label: "Trade-in IMEI 1" },
                  { key: "trade_imei2", label: "Trade-in IMEI 2" },
                  { key: "trade_condition", label: "Trade-in condition" },
                  {
                    key: "trade_pta_status",
                    label: "Trade-in PTA status",
                    options: ["approved", "non_approved", "pending", "unknown"],
                  },
                  ...conditionChecks.map(({ key, label }) => ({
                    key: `trade_${key}`,
                    label: `Trade-in ${label}`,
                  })),
                  {
                    key: "trade_box_included",
                    label: "Trade-in box included",
                    type: "checkbox",
                  },
                  {
                    key: "trade_charger_included",
                    label: "Trade-in charger included",
                    type: "checkbox",
                  },
                  { key: "notes", label: "Notes" },
                ]
              : [
                  { key: "supplier_id", label: "Supplier", source: "supplier" },
                  { key: "reference", label: "Reference" },
                  { key: "paid", label: "Amount paid", type: "number" },
                  {
                    key: "payment_method",
                    label: "Method",
                    options: paymentMethods,
                  },
                ]
          }
          value={form}
          setValue={setForm}
          lookups={lookups}
        />
        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-4">
            <CardTitle>Add items</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search stock by name, model, barcode, or SKU. Phone details appear
              when you choose a handset.
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex max-w-lg gap-2">
              <Input
                aria-label="Scan barcode or SKU"
                placeholder="Scan barcode or enter SKU"
                value={text(line.scan ?? "")}
                onChange={(e) => setLine({ ...line, scan: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const found = lookups.products?.find(
                      (p) => p.barcode === line.scan || p.sku === line.scan,
                    );
                    if (found) pickProduct(found);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const found = lookups.products?.find(
                    (p) => p.barcode === line.scan || p.sku === line.scan,
                  );
                  if (found) pickProduct(found);
                }}
              >
                Find
              </Button>
            </div>
            <FormFields
              fields={[
                {
                  key: "product_id",
                  label: "Product",
                  source: "products",
                  required: true,
                },
              ]}
              value={line}
              setValue={(next) => {
                if (next.product_id !== line.product_id) {
                  const picked = lookups.products?.find(
                    (item) => String(item.id) === String(next.product_id),
                  );
                  if (picked) pickProduct(picked);
                  else setLine({ product_id: "" });
                } else setLine(next);
              }}
              lookups={lookups}
            />
            {product && (
              <Card
                key={String(product.id)}
                className="entry-reveal mt-4 border-emerald-200 bg-card"
              >
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    {String(product.category) === "phone" ? (
                      <Smartphone className="size-5 text-emerald-700" />
                    ) : (
                      <Boxes className="size-5 text-emerald-700" />
                    )}
                    {String(product.category) === "phone"
                      ? isSale
                        ? "Choose this handset"
                        : "Add an IMEI-tracked handset"
                      : "Set quantity and price"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {text(product.name)} · {text(product.category)}
                  </p>
                </CardHeader>
                <CardContent>
                  <FormFields
                    fields={[
                      ...(String(product.category) === "phone"
                        ? isSale
                          ? [
                              {
                                key: "phone_id",
                                label: "Available IMEI",
                                source: "phones",
                                required: true,
                              },
                            ]
                          : [
                              { key: "imei1", label: "IMEI 1", required: true },
                              { key: "imei2", label: "IMEI 2" },
                              {
                                key: "pta_status",
                                label: "PTA status",
                                options: [
                                  "approved",
                                  "non_approved",
                                  "pending",
                                  "unknown",
                                ],
                              },
                              {
                                key: "condition_grade",
                                label: "Condition grade",
                              },
                              ...conditionChecks,
                              {
                                key: "box_included",
                                label: "Box included",
                                type: "checkbox",
                              },
                              {
                                key: "charger_included",
                                label: "Charger included",
                                type: "checkbox",
                              },
                            ]
                        : [
                            {
                              key: "quantity",
                              label: "Quantity",
                              type: "number",
                              required: true,
                            },
                          ]),
                      {
                        key: isSale ? "unit_price" : "unit_cost",
                        label: isSale ? "Unit sale price" : "Unit cost",
                        type: "number",
                        required: true,
                      },
                    ]}
                    value={line}
                    setValue={setLine}
                    lookups={{
                      ...lookups,
                      phones:
                        lookups.phones
                          ?.filter(
                            (p) =>
                              String(p.product_id) === String(product?.id) &&
                              p.status === "available",
                          )
                          .map((p) => ({
                            ...p,
                            name: `${String(p.imei1)} — ${String(p.product_name)}`,
                          })) ?? [],
                    }}
                  />
                </CardContent>
              </Card>
            )}
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={
                !product ||
                (String(product.category) === "phone" &&
                  (isSale ? !line.phone_id : !line.imei1))
              }
              onClick={add}
            >
              Add item
            </Button>
          </CardContent>
        </Card>
        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <Card key={i} className="entry-reveal">
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span>
                    {text(
                      lookups.products?.find(
                        (p) => Number(p.id) === Number(l.product_id),
                      )?.name,
                    )}{" "}
                    ·{" "}
                    {l.imeis
                      ? text((l.imeis as Row[])[0]?.imei1)
                      : `× ${text(l.quantity)}`}
                  </span>
                  <div className="flex gap-4">
                    <span>{money(l[isSale ? "unit_price" : "unit_cost"])}</span>
                    <button
                      onClick={() => setLines(lines.filter((_, j) => i !== j))}
                      className="text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {isSale && (
          <Card className="bg-muted/20">
            <CardHeader className="pb-4">
              <CardTitle>Split payments</CardTitle>
            </CardHeader>
            <CardContent>
              <FormFields
                fields={[
                  { key: "payment_amount", label: "Amount", type: "number" },
                  {
                    key: "payment_method",
                    label: "Method",
                    options: paymentMethods,
                  },
                ]}
                value={form}
                setValue={setForm}
                lookups={lookups}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  const amount = Number(form.payment_amount);
                  if (amount > 0) {
                    setPayments([
                      ...payments,
                      { amount, method: form.payment_method || "cash" },
                    ]);
                    setForm({ ...form, payment_amount: "" });
                  }
                }}
              >
                Add payment
              </Button>
              {payments.map((payment, i) => (
                <div
                  key={i}
                  className="mt-2 flex justify-between rounded-lg border p-2 text-sm"
                >
                  <span>
                    {text(payment.method)} · {money(payment.amount)}
                  </span>
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() =>
                      setPayments(payments.filter((_, j) => i !== j))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {formError}
          </div>
        )}
        <Button
          disabled={busy || lines.length === 0}
          onClick={async () => {
            setFormError("");
            const body: Row = { ...form, lines };
            if (isSale) {
              body.payments = payments;
              if (Number(form.trade_in_value) > 0) {
                body.trade_in = {
                  product_id: Number(form.trade_product_id),
                  imei1: String(form.trade_imei1 || ""),
                  imei2: String(form.trade_imei2 || ""),
                  condition_grade: String(form.trade_condition || ""),
                  pta_status: String(form.trade_pta_status || "unknown"),
                  checklist: checklistFrom(form, "trade_"),
                  box_included: Boolean(form.trade_box_included),
                  charger_included: Boolean(form.trade_charger_included),
                };
              }
              delete body.payment_amount;
              delete body.trade_product_id;
              delete body.trade_imei1;
              delete body.trade_imei2;
              delete body.trade_condition;
              delete body.trade_pta_status;
              for (const { key } of conditionChecks)
                delete body[`trade_${key}`];
              delete body.trade_box_included;
              delete body.trade_charger_included;
            }
            try {
              await submit(isSale ? "sales" : "purchases", body);
            } catch (err: unknown) {
              setFormError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          {isSale ? "Complete sale" : "Save purchase"}
        </Button>
      </CardContent>
    </Card>
  );
}
function Details({
  section,
  row,
  request,
  submit,
  lookups,
  busy,
  settings,
  canReturn,
}: {
  section: string;
  row: Row;
  request: <T>(method: string, path: string, body?: Row) => Promise<T>;
  submit: (path: string, body: Row, method?: string) => Promise<void>;
  lookups: Record<string, Row[]>;
  busy: boolean;
  settings: ShopSettings;
  canReturn: boolean;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [purchaseLines, setPurchaseLines] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({});
  const [partForm, setPartForm] = useState<Row>({ part_id: "", part_quantity: 1 });
  const [returnForm, setReturnForm] = useState<Row>({ quantity: 1, refund_method: "cash", restock: true });
  useEffect(() => {
    setDetail(null);
    setPurchaseLines([]);
    setReturnForm({ quantity: 1, refund_method: "cash", restock: true });
    setPartForm({ part_id: "", part_quantity: 1 });
    if (section === "products") {
      setForm({
        name: row.name ?? "",
        price: row.price ?? 0,
        cost: row.cost ?? 0,
        min_price: row.min_price ?? 0,
        reorder_level: row.reorder_level ?? 0,
      });
    } else if (section === "repairs") {
      setForm({
        status: row.status ?? "Received",
        labor_charge: row.labor_charge ?? 0,
        other_cost: row.other_cost ?? 0,
        technician_id: row.technician_id ?? "",
        expected_date: row.expected_date ?? "",
      });
      request<Row>("GET", `repairs/${row.id}`)
        .then(setDetail)
        .catch(() => {});
    } else if (section === "warranties") {
      setForm({
        status: row.status ?? "open",
        action: row.action ?? "",
        result: row.result ?? "",
      });
    } else {
      setForm({});
    }
    if (section === "sales")
      request<Row>("GET", `sales/${row.id}`)
        .then(setDetail)
        .catch(() => {});
    if (section === "purchases")
      request<Row[]>("GET", `purchase-lines?purchase_id=${row.id}`)
        .then(setPurchaseLines)
        .catch(() => {});
  }, [row, section, request]);
  if (
    ![
      "sales",
      "purchases",
      "used",
      "repairs",
      "warranties",
      "products",
      "customers",
      "suppliers",
    ].includes(section)
  )
    return null;
  const edit =
    section === "products"
      ? {
          title: "Update product",
          path: `products/${row.id}`,
          method: "PATCH",
          fields: [
            { key: "name", label: "Name" },
            { key: "price", label: "Price", type: "number" },
            { key: "cost", label: "Cost", type: "number" },
            { key: "min_price", label: "Minimum price", type: "number" },
            { key: "reorder_level", label: "Reorder level", type: "number" },
          ],
        }
      : section === "repairs"
        ? {
            title: "Update repair",
            path: `repairs/${row.id}`,
            method: "PATCH",
            fields: [
              {
                key: "status",
                label: "Status",
                options: [
                  "Received",
                  "Checking",
                  "Waiting for Part",
                  "In Repair",
                  "Ready",
                  "Delivered",
                ],
              },
              { key: "labor_charge", label: "Labor charge", type: "number" },
              {
                key: "other_cost",
                label: "Technician/other cost",
                type: "number",
              },
              {
                key: "technician_id",
                label: "Technician",
                source: "technician",
              },
              { key: "expected_date", label: "Expected date", type: "date" },
            ],
          }
        : section === "warranties"
          ? {
              title: "Update claim",
              path: `warranties/${row.id}`,
              method: "PATCH",
              fields: [
                {
                  key: "status",
                  label: "Status",
                  options: ["open", "approved", "rejected", "resolved"],
                },
                { key: "action", label: "Action" },
                { key: "result", label: "Result" },
              ],
            }
          : section === "used"
            ? {
                title: "Pay seller",
                path: `used-purchases/${row.id}/pay`,
                method: "POST",
                fields: [
                  {
                    key: "amount",
                    label: "Amount",
                    type: "number",
                    required: true,
                  },
                  { key: "method", label: "Method", options: paymentMethods },
                ],
              }
            : section === "purchases"
              ? {
                  title: "Pay supplier",
                  path: "payments",
                  method: "POST",
                  fields: [
                    {
                      key: "amount",
                      label: "Amount",
                      type: "number",
                      required: true,
                    },
                    { key: "method", label: "Method", options: paymentMethods },
                  ],
                }
              : section === "sales"
                ? {
                    title: "Receive payment",
                    path: "payments",
                    method: "POST",
                    fields: [
                      {
                        key: "amount",
                        label: "Amount",
                        type: "number",
                        required: true,
                      },
                      {
                        key: "method",
                        label: "Method",
                        options: paymentMethods,
                      },
                    ],
                  }
                : null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {section === "sales"
            ? text(row.invoice_no)
            : text(row.name ?? row.job_no ?? row.id)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {section === "sales" && detail && (
          <>
            <Grid
              rows={(detail.lines as Row[]) ?? []}
              columns={[
                "description",
                "imei1",
                "quantity",
                "unit_price",
                "warranty_days",
              ]}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border p-4 bg-muted/20">
              <div>
                <div className="text-xs text-muted-foreground">Subtotal</div>
                <div className="mt-1 text-base font-semibold">{money(detail.subtotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Discount</div>
                <div className="mt-1 text-base font-semibold text-emerald-600">
                  {Number(detail.discount) > 0 ? `-${money(detail.discount)}` : money(detail.discount)}
                </div>
              </div>
              {Number(detail.trade_in_value) > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Trade-in</div>
                  <div className="mt-1 text-base font-semibold text-emerald-600">
                    -{money(detail.trade_in_value)}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="mt-1 text-lg font-bold">{money(detail.total)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="mt-1 text-base font-semibold">{money(detail.paid)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="mt-1 text-base font-semibold text-amber-600">
                  {money(detail.balance ?? (Number(detail.total) - Number(detail.paid)))}
                </div>
              </div>
            </div>
            <Receipt sale={detail} settings={settings} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.print()}>Print invoice</Button>
              <Button variant="outline" onClick={() => void saveInvoicePdf(detail, settings).catch((e) => window.alert(String(e)))}>Save PDF invoice</Button>
            </div>
            {(detail.returns as Row[] | undefined)?.length ? (
              <Grid rows={detail.returns as Row[]} columns={["date", "description", "imei1", "quantity", "amount", "refund", "refund_method", "restock"]} />
            ) : null}
            {canReturn && <form className="space-y-3 rounded-xl border p-4" onSubmit={(e) => {
              e.preventDefault();
              void submit(`sales/${row.id}/returns`, { ...returnForm, sale_line_id: Number(returnForm.sale_line_id), quantity: Number(returnForm.quantity) })
                .then(() => request<Row>("GET", `sales/${row.id}`).then(setDetail));
            }}>
              <div className="font-medium">Customer return / refund</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>Sold item</Label><select required className="h-10 w-full rounded-lg border bg-background px-3" value={String(returnForm.sale_line_id ?? "")} onChange={(e) => setReturnForm({ ...returnForm, sale_line_id: e.target.value })}>
                  <option value="">Choose item</option>
                  {((detail.lines as Row[]) ?? []).map((item) => <option key={String(item.id)} value={String(item.id)}>{text(item.description)} {item.imei1 ? `· ${text(item.imei1)}` : ""}</option>)}
                </select></div>
                <div><Label>Quantity</Label><Input type="number" min="1" step="1" required value={Number(returnForm.quantity ?? 1)} onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })} /></div>
                <div><Label>Refund method</Label><select className="h-10 w-full rounded-lg border bg-background px-3" value={String(returnForm.refund_method ?? "cash")} onChange={(e) => setReturnForm({ ...returnForm, refund_method: e.target.value })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></div>
              </div>
              <div><Label>Reason</Label><Input value={String(returnForm.reason ?? "")} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(returnForm.restock)} onChange={(e) => setReturnForm({ ...returnForm, restock: e.target.checked })} /> Return item to sellable stock</label>
              <Button type="submit" disabled={busy}>Record return</Button>
            </form>}
          </>
        )}
        {section === "products" && (
          <>
            <ProductLabel product={row} settings={settings} />
            <Button
              variant="outline"
              disabled={!barcodeValue(row)}
              onClick={() => window.print()}
            >
              Print product label
            </Button>
          </>
        )}
        {section === "repairs" && (
          <div className="space-y-3">
            <h3 className="font-medium">Consumed spare parts</h3>
            {(detail?.parts as Row[] | undefined)?.length ? (
              <Grid
                rows={detail!.parts as Row[]}
                columns={["product_name", "sku", "quantity", "unit_cost"]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No spare parts consumed for this repair.</p>
            )}
          </div>
        )}
        {section === "repairs" && row.status === "Ready" && (
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard.writeText(
                `Your phone ${text(row.model)} is ready for collection. Job ${text(row.job_no)}. Please contact the shop for pickup.`,
              )
            }
          >
            Copy ready message
          </Button>
        )}
        {section === "repairs" && (
          <Button
            variant="outline"
            onClick={() =>
              void saveRepairPdf(detail || row, settings).catch((e) =>
                window.alert(String(e)),
              )
            }
          >
            Save PDF job card
          </Button>
        )}
        {edit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body = { ...form };
              if (section === "purchases") body.purchase_id = row.id;
              if (section === "sales") body.sale_id = row.id;
              void submit(edit.path, body, edit.method);
            }}
            className="space-y-4"
          >
            <div className="font-medium">{edit.title}</div>
            <FormFields
              fields={edit.fields}
              value={form}
              setValue={setForm}
              lookups={lookups}
            />
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </form>
        )}
        {section === "repairs" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`repairs/${row.id}/parts`, {
                product_id: Number(partForm.part_id),
                quantity: Number(partForm.part_quantity || 1),
              }).then(() => {
                setPartForm({ part_id: "", part_quantity: 1 });
                request<Row>("GET", `repairs/${row.id}`).then(setDetail);
              });
            }}
            className="space-y-4 border-t pt-4"
          >
            <div className="font-medium">Consume spare part</div>
            <FormFields
              fields={[
                { key: "part_id", label: "Spare part", source: "products" },
                { key: "part_quantity", label: "Quantity", type: "number" },
              ]}
              value={partForm}
              setValue={setPartForm}
              lookups={lookups}
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Use part
            </Button>
          </form>
        )}
        {section === "purchases" && (
          <Grid
            rows={purchaseLines}
            columns={["id", "product_name", "imei1", "quantity", "unit_cost"]}
            onPick={(line) =>
              setForm({ ...form, purchase_line_id: line.id, quantity: 1 })
            }
          />
        )}
        {section === "purchases" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit("purchase-returns", {
                purchase_line_id: Number(form.purchase_line_id),
                quantity: Number(form.quantity),
                reason: form.reason,
              });
            }}
            className="space-y-4 border-t pt-4"
          >
            <div className="font-medium">Return to supplier</div>
            <FormFields
              fields={[
                {
                  key: "purchase_line_id",
                  label: "Purchase line ID",
                  type: "number",
                },
                { key: "quantity", label: "Quantity", type: "number" },
                { key: "reason", label: "Reason" },
              ]}
              value={form}
              setValue={setForm}
              lookups={lookups}
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Return item
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
function ProductLabel({ product, settings }: { product: Row; settings: ShopSettings }) {
  const barcode = barcodeValue(product);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (barcode && svg.current) {
      JsBarcode(svg.current, barcode, {
        format: "CODE128",
        width: 1.5,
        height: 38,
        margin: 0,
        displayValue: false,
      });
    }
  }, [barcode]);
  return (
    <div className="print-sheet hidden">
      <div className="mx-auto w-64 border border-black p-4 text-center">
        {settings.logo_data && <img src={settings.logo_data} alt="" className="mx-auto mb-2 size-9 object-contain" />}
        <div className="text-xs font-semibold">{settings.shop_name.toUpperCase()}</div>
        <div className="mt-3 text-lg font-bold">{text(product.name)}</div>
        <div className="text-xs">
          {text(product.brand)} {text(product.model)}
        </div>
        <div className="mt-3 text-2xl font-bold">{money(product.price)}</div>
        {barcode && (
          <svg
            ref={svg}
            aria-label={`Barcode ${barcode}`}
            className="mx-auto mt-3 max-w-full"
          />
        )}
        <div className="mt-1 font-mono text-xs">{barcode}</div>
      </div>
    </div>
  );
}
function Receipt({ sale, settings }: { sale: Row; settings: ShopSettings }) {
  const lines = (sale.lines as Row[]) ?? [];
  return (
    <div className="print-sheet hidden">
      <div className="text-center">
        {settings.logo_data && <img src={settings.logo_data} alt="" className="mx-auto mb-2 size-12 object-contain" />}
        <h1 className="text-2xl font-bold">{settings.shop_name}</h1>
        {settings.phone && <p className="text-xs">{settings.phone}</p>}
        {settings.address && <p className="text-xs">{settings.address}</p>}
        <p>Sales receipt</p>
      </div>
      <div className="mt-5 flex justify-between text-sm">
        <span>{text(sale.invoice_no)}</span>
        <span>{text(sale.date)}</span>
      </div>
      <p className="mt-2 text-sm">
        Customer: {text(sale.customer)} · {text(sale.customer_phone)}
      </p>
      <table className="mt-5 w-full text-left text-sm">
        <thead>
          <tr>
            <th>Item</th>
            <th>IMEI</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{text(l.description)}</td>
              <td>{text(l.imei1)}</td>
              <td>{text(l.quantity)}</td>
              <td>{money(l.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 space-y-1 border-t pt-3 text-right text-sm">
        <p>Subtotal: {money(sale.subtotal)}</p>
        <p>Discount: {money(sale.discount)}</p>
        <p className="font-bold">Total: {money(sale.total)}</p>
        <p>Paid: {money(sale.paid)}</p>
        <p>Balance: {money(Number(sale.total) - Number(sale.paid))}</p>
      </div>
      {settings.receipt_footer && <p className="mt-10 text-center text-xs">{settings.receipt_footer}</p>}
    </div>
  );
}
function CashPanel({
  rows,
  submit,
  request,
  busy,
}: {
  rows: Row[];
  submit: (path: string, body: Row) => Promise<void>;
  request: <T>(method: string, path: string, body?: Row) => Promise<T>;
  busy: boolean;
}) {
  const [opening, setOpening] = useState("0");
  const [actual, setActual] = useState("0");
  const open = rows.find((r) => !r.closed_at);
  const [sessionId, setSessionId] = useState("");
  const [report, setReport] = useState<Row | null>(null);
  const [reportError, setReportError] = useState("");
  const loadCashReport = useCallback((id: string) => {
    if (!id) return;
    request<Row>("GET", `cash/${id}/report`)
      .then((result) => {
        setReport(result);
        setReportError("");
      })
      .catch((e) => {
        setReport(null);
        setReportError(String(e));
      });
  }, [request]);

  useEffect(() => {
    if (!rows.length) {
      setSessionId("");
      setReport(null);
      setReportError("");
      return;
    }
    const found = rows.some((r) => String(r.id) === sessionId);
    if (!found) {
      setSessionId(String(rows[0].id));
    }
  }, [rows, sessionId]);

  useEffect(() => {
    if (sessionId && rows.some((r) => String(r.id) === sessionId)) {
      loadCashReport(sessionId);
    }
  }, [sessionId, rows, loadCashReport]);

  return (
    <div className="mt-5 space-y-5"><Card>
      <CardHeader>
        <CardTitle>{open ? "Close register" : "Open register"}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div>
          <Label>{open ? "Actual closing cash" : "Opening cash"}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={open ? actual : opening}
            onChange={(e) =>
              open ? setActual(e.target.value) : setOpening(e.target.value)
            }
          />
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            void submit(
              open ? "cash/close" : "cash/open",
              open
                ? { id: open.id, actual_closing: Number(actual) }
                : { opening: Number(opening) },
            )
          }
        >
          {open ? "Close session" : "Open session"}
        </Button>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Daily closing report</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex items-end gap-2">
        <div>
          <Label>Cash session</Label>
          <select
            aria-label="Cash session"
            className="h-10 rounded-lg border bg-background px-3"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setReportError("");
            }}
          >
            {rows.map((session) => (
              <option key={String(session.id)} value={String(session.id)}>
                {formatDateTime(session.opened_at)} · #{text(session.id)}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          disabled={!sessionId || !rows.some((r) => String(r.id) === sessionId)}
          onClick={() => loadCashReport(sessionId)}
        >
          Load report
        </Button>
      </div>
      {reportError && <p role="alert" className="text-sm text-red-700">{reportError}</p>}
      {report && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Opening cash", (report.session as Row)?.opening], ["Cash received", report.cash_in], ["Cash paid out", report.cash_out], ["Cash expenses", report.cash_expenses], ["Drawings", report.drawings], ["Expected cash", report.expected], ["Counted cash", (report.session as Row)?.actual_closing], ["Difference", report.variance]].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-4"><div className="text-xs text-muted-foreground">{String(label)}</div><div className="mt-1 text-lg font-semibold">{value == null ? "—" : money(value)}</div></div>)}
        </div>
        <div><h3 className="mb-2 font-medium">Payments by method</h3><Grid rows={(report.payments as Row[]) ?? []} columns={["method", "direction", "amount", "count"]} /></div>
        <div><h3 className="mb-2 font-medium">Customer refunds</h3><Grid rows={(report.refunds as Row[]) ?? []} columns={["date", "invoice_no", "amount", "refund", "refund_method", "reason"]} /></div>
        <div><h3 className="mb-2 font-medium">Expenses</h3><Grid rows={(report.expenses as Row[]) ?? []} columns={["category", "method", "amount"]} /></div>
      </>}
    </CardContent></Card></div>
  );
}
function InstallmentPanel({
  rows,
  submit,
  busy,
}: {
  rows: Row[];
  submit: (path: string, body: Row) => Promise<void>;
  busy: boolean;
}) {
  const [id, setId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const outstanding = rows.filter((r) => Number(r.paid) < Number(r.amount));
  useEffect(() => {
    if (id && !outstanding.some((row) => String(row.id) === id)) {
      setId("");
      setAmount("");
    }
  }, [rows, id]);
  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Collect installment</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <SearchSelect
          id="installment-choice"
          ariaLabel="Installment"
          value={id}
          onChange={setId}
          placeholder="Search installment"
          options={outstanding.map((row) => ({
            value: String(row.id),
            label: `${text(row.invoice_no)} · ${text(row.due_date)}`,
            description: `${text(row.customer)} · ${money(Number(row.amount) - Number(row.paid))} due`,
            searchText: String(row.phone ?? ""),
          }))}
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          aria-label="Payment method"
          className="rounded-lg border bg-background px-3"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {paymentMethods.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <Button
          disabled={busy || !id || Number(amount) <= 0}
          onClick={() =>
            void submit(`installments/${id}/pay`, {
              amount: Number(amount),
              method,
            })
          }
        >
          Record payment
        </Button>
      </CardContent>
      {id && (
        <CardContent className="pt-0">
          <Button
            variant="outline"
            onClick={() => {
              const installment = rows.find((r) => String(r.id) === id);
              if (installment)
                void navigator.clipboard.writeText(
                  `Payment reminder: ${text(installment.customer)}, installment for ${text(installment.invoice_no)} is due on ${text(installment.due_date)}. Remaining: ${money(Number(installment.amount) - Number(installment.paid))}.`,
                );
            }}
          >
            Copy customer reminder
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
function LedgerPanel({
  request,
  lookups,
}: {
  request: <T>(method: string, path: string, body?: Row) => Promise<T>;
  lookups: Record<string, Row[]>;
}) {
  const [kind, setKind] = useState("customer");
  const [contactId, setContactId] = useState("");
  const [ledger, setLedger] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const queryVersion = useRef(0);
  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const version = ++queryVersion.current;
          request<Row>("GET", `ledger?kind=${kind}&contact_id=${contactId}`)
            .then((value) => {
              if (version === queryVersion.current) setLedger(value);
            })
            .catch((e) => {
              if (version === queryVersion.current) setError(String(e));
            });
        }}
      >
        <select
          aria-label="Ledger type"
          className="rounded-lg border bg-background px-3"
          value={kind}
          onChange={(e) => {
            queryVersion.current++;
            setKind(e.target.value);
            setContactId("");
            setLedger(null);
            setError("");
          }}
        >
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
        </select>
        <div className="min-w-52 flex-1">
          <SearchSelect
            id="ledger-contact"
            ariaLabel="Ledger contact"
            value={contactId}
            required
            placeholder="Search ledger contact"
            options={(
              lookups[kind === "customer" ? "customer" : "supplier"] ?? []
            ).map((contact) => ({
              value: String(contact.id),
              label: String(contact.name),
              description: String(contact.phone ?? ""),
            }))}
            onChange={(value) => {
              queryVersion.current++;
              setContactId(value);
              setLedger(null);
              setError("");
            }}
          />
        </div>
        <Button type="submit">View ledger</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ledger && (
        <>
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">
                Outstanding balance
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {money(ledger.balance)}
              </div>
            </CardContent>
          </Card>
          <Grid
            rows={(ledger.transactions as Row[]) ?? []}
            columns={["date", "reference", "type", "amount", "paid"]}
          />
          <h2 className="font-semibold">Payments</h2>
          <Grid
            rows={(ledger.payments as Row[]) ?? []}
            columns={["date", "direction", "method", "amount", "notes"]}
          />
        </>
      )}
    </div>
  );
}
function SchedulePanel({
  submit,
  busy,
  sales,
  installments,
}: {
  submit: (path: string, body: Row) => Promise<void>;
  busy: boolean;
  sales: Row[];
  installments: Row[];
}) {
  const [saleId, setSaleId] = useState("");
  const [due, setDue] = useState("");
  const [amount, setAmount] = useState("");
  const [entries, setEntries] = useState<
    { due_date: string; amount: number }[]
  >([]);
  const scheduled = new Set(installments.map((row) => String(row.sale_id)));
  const eligible = sales.filter(
    (sale) =>
      Number(sale.total) > Number(sale.paid) &&
      sale.customer_id &&
      !scheduled.has(String(sale.id)),
  );
  const selected = eligible.find((sale) => String(sale.id) === saleId);
  const balance = selected ? Number(selected.total) - Number(selected.paid) : 0;
  const planTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Schedule installments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-md">
          <SearchSelect
            id="credit-sale"
            ariaLabel="Credit sale"
            value={saleId}
            placeholder="Search credit sale"
            options={eligible.map((sale) => ({
              value: String(sale.id),
              label: `${text(sale.invoice_no)} · ${text(sale.customer)}`,
              description: `${money(Number(sale.total) - Number(sale.paid))} due`,
            }))}
            onChange={(value) => {
              setSaleId(value);
              setEntries([]);
            }}
          />
        </div>
        {selected && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                aria-label="Due date"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              <Input
                aria-label="Installment amount"
                placeholder="Installment amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!due || Number(amount) <= 0}
                onClick={() => {
                  setEntries([
                    ...entries,
                    { due_date: due, amount: Number(amount) },
                  ]);
                  setDue("");
                  setAmount("");
                }}
              >
                Add due date
              </Button>
            </div>
            {entries.map((entry, index) => (
              <div
                key={`${entry.due_date}-${index}`}
                className="flex justify-between rounded-lg border p-3 text-sm"
              >
                <span>
                  {entry.due_date} · {money(entry.amount)}
                </span>
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() =>
                    setEntries(entries.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="text-sm text-muted-foreground">
              Scheduled {money(planTotal)} of {money(balance)} balance
            </div>
            <Button
              disabled={
                busy ||
                entries.length === 0 ||
                Math.abs(planTotal - balance) > 0.01
              }
              onClick={() =>
                void submit(`sales/${saleId}/installments`, { entries })
              }
            >
              Save schedule
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
function Reports({
  data,
  request,
  setError,
}: {
  data: Row;
  request: <T>(method: string, path: string, body?: Row) => Promise<T>;
  setError: (message: string) => void;
}) {
  const [from, setFrom] = useState(String(data.from ?? ""));
  const [to, setTo] = useState(String(data.to ?? ""));
  const [report, setReport] = useState<Row | null>(null);
  const shown = report ?? data;
  useEffect(() => {
    setFrom(String(data.from ?? ""));
    setTo(String(data.to ?? ""));
    setReport(null);
  }, [data]);
  const sections: [string, string[]][] = [
    ["Sales", ["day", "count", "revenue", "discounts"]],
    ["Categories", ["category", "units", "revenue", "gross_profit"]],
    ["Staff", ["name", "sales", "revenue", "discounts", "collections"]],
    ["Fast stock", ["name", "units_sold", "revenue"]],
    ["Slow stock", ["name", "quantity", "last_sale"]],
    ["Phone profit", ["invoice_no", "imei1", "product_name", "profit"]],
    ["Returns", ["date", "invoice_no", "description", "quantity", "amount", "refund", "refund_method", "restock"]],
  ];
  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (from > to) {
            setError("From date must be before To date");
            return;
          }
          setError("");
          request<Row>("GET", `reports?from=${from}&to=${to}`)
            .then(setReport)
            .catch((e) => setError(String(e)));
        }}
      >
        <div>
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button type="submit">Apply dates</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "Accessory cost",
            shown.stock && (shown.stock as Row).accessory_cost,
          ],
          [
            "Phone stock cost",
            shown.phoneStock && (shown.phoneStock as Row).cost,
          ],
          ["Expenses", shown.expenses && (shown.expenses as Row).total],
          ["Repair profit", shown.repairs && (shown.repairs as Row).profit],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">
                {String(label)}
              </div>
              <div className="mt-2 text-2xl font-semibold">{money(value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ReportCharts data={shown} />
      {sections.map(([title, columns]) => (
        <div key={title}>
          <h2 className="mb-3 font-semibold">{title}</h2>
          <Grid
            rows={
              Array.isArray(
                shown[
                  title === "Slow stock"
                    ? "slow"
                    : title === "Fast stock"
                      ? "fast"
                      : title === "Phone profit"
                        ? "phoneProfit"
                        : title.toLowerCase()
                ],
              )
                ? (shown[
                    title === "Slow stock"
                      ? "slow"
                      : title === "Fast stock"
                        ? "fast"
                        : title === "Phone profit"
                          ? "phoneProfit"
                          : title.toLowerCase()
                  ] as Row[])
                : []
            }
            columns={columns}
          />
        </div>
      ))}
    </div>
  );
}
function UpdatePanel() {
  const [status, setStatus] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <Card className="mt-5"><CardHeader><CardTitle>Signed updates</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Updates are verified against the release signing key before installation.</p>
    <Button variant="outline" disabled={busy} onClick={() => {setBusy(true);setError("");void invoke<Row>("check_updates").then(setStatus).catch((e) => setError(String(e))).finally(() => setBusy(false));}}>Check for updates</Button>
    {status && <p className="text-sm">{!status.configured ? "This build has no update feed configured." : status.available ? `Version ${text(status.version)} is available. ${text(status.notes)}` : "You have the latest version."}</p>}
    {Boolean(status?.available) && <Button disabled={busy} onClick={() => {setBusy(true);setError("");void invoke("install_update").catch((e) => setError(String(e))).finally(() => setBusy(false));}}>Install signed update</Button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </CardContent></Card>;
}
function BackupPanel({
  rows,
  request,
  refresh,
  setError,
}: {
  rows: Row[];
  request: <T>(method: string, path: string, body?: Row) => Promise<T>;
  refresh: () => Promise<void>;
  setError: (x: string) => void;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [externalNames, setExternalNames] = useState<string[]>([]);
  const [location, setLocation] = useState("local");
  const [preferences, setPreferences] = useState<Row>({ destination: "", enabled: false, interval_hours: 24 });
  const [verification, setVerification] = useState("");
  const [restorePending, setRestorePending] = useState(false);
  useEffect(() => {
    request<string[]>("GET", "backup")
      .then(setNames)
      .catch((e) => setError(String(e)));
    request<Row>("GET", "backup/preferences").then(setPreferences).catch((e) => setError(String(e)));
    request<string[]>("GET", "backup/external").then(setExternalNames).catch(() => {});
  }, [request, setError]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups and restore</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Local snapshots remain beside the database. Choose a folder on another drive for scheduled verified copies. Restore creates a safety snapshot first.
        </p>
        <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
          <div className="md:col-span-2 font-medium">External backup destination</div>
          <div className="flex gap-2 md:col-span-2"><Input readOnly aria-label="Backup destination" value={String(preferences.destination ?? "")} placeholder="Choose a folder on another drive" /><Button variant="outline" onClick={() => void open({ directory: true, multiple: false }).then((folder) => { if (typeof folder === "string") setPreferences({ ...preferences, destination: folder }); }).catch((e) => setError(String(e)))}>Choose folder</Button></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(preferences.enabled)} onChange={(e) => setPreferences({ ...preferences, enabled: e.target.checked })} /> Enable scheduled copies</label>
          <div><Label>Hours between copies</Label><Input type="number" min="1" max="720" value={Number(preferences.interval_hours ?? 24)} onChange={(e) => setPreferences({ ...preferences, interval_hours: Number(e.target.value) })} /></div>
          <div className="flex flex-wrap gap-2 md:col-span-2"><Button onClick={() => void request<Row>("PUT", "backup/preferences", preferences).then(setPreferences).catch((e) => setError(String(e)))}>Save backup schedule</Button><Button variant="outline" onClick={() => void request<Row>("POST", "backup/external").then(() => request<string[]>("GET", "backup/external")).then(setExternalNames).catch((e) => setError(String(e)))}>Copy to destination now</Button></div>
          <div className="text-xs text-muted-foreground md:col-span-2">Last successful copy: {text(preferences.last_success) || "none"} {preferences.last_error ? `· ${text(preferences.last_error)}` : ""}</div>
        </div>
        <Button
          onClick={() =>
            request<Row>("POST", "backup")
              .then(() => request<string[]>("GET", "backup"))
              .then(setNames)
              .catch((e) => setError(String(e)))
          }
        >
          Create backup
        </Button>
        <div className="flex gap-2">
          <select
            aria-label="Backup location"
            value={location}
            onChange={(e) => {setLocation(e.target.value);setName("");setVerification("");setRestorePending(false);}}
            className="rounded-lg border bg-background px-3"
          ><option value="local">Local</option><option value="external">External</option></select>
          <select
            value={name}
            onChange={(e) => {setName(e.target.value);setRestorePending(false);}}
            className="rounded-lg border bg-background px-3"
          >
            <option value="">Select backup</option>
            {(location === "external" ? externalNames : names).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={!name}
            onClick={() => setRestorePending(true)}
          >
            Review restore
          </Button>
          <Button variant="outline" disabled={!name} onClick={() => void request<Row>("POST", "backup/verify", { name, location }).then(() => setVerification(`${name} verified`)).catch((e) => setError(String(e)))}>Verify backup</Button>
        </div>
        {restorePending && <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p>Restore <strong>{name}</strong> from {location}? Current shop data will be replaced after a safety copy is made.</p>
          <div className="flex gap-2"><Button onClick={() => void request("POST", "restore", { name, location }).then(() => {setRestorePending(false);return refresh();}).catch((e) => setError(String(e)))}>Confirm restore</Button><Button variant="outline" onClick={() => setRestorePending(false)}>Cancel</Button></div>
        </div>}
        {verification && <p className="text-sm text-emerald-700">{verification}</p>}
        <div className="text-sm text-muted-foreground">
          {names.length} local and {externalNames.length} external backup files available · {rows.length} rows
        </div>
      </CardContent>
    </Card>
  );
}
function ImeiHistoryView({ result }: { result: Row }) {
  const phone = (result.phone as Row) ?? {};
  const sale = result.sale as Row | null;
  const warranty = (result.warranty as Row[]) ?? [];
  const repairs = (result.repairs as Row[]) ?? [];
  const movements = (result.movements as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">
              {text(phone.product_name) || "Handset details"}
            </CardTitle>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                phone.status === "available"
                  ? "bg-emerald-100 text-emerald-800"
                  : phone.status === "sold"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {text(phone.status || "Unknown")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Primary IMEI (IMEI 1)</div>
              <div className="mt-1 font-mono text-sm font-medium">{text(phone.imei1)}</div>
            </div>
            {phone.imei2 ? (
              <div>
                <div className="text-xs text-muted-foreground">Secondary IMEI (IMEI 2)</div>
                <div className="mt-1 font-mono text-sm font-medium">{text(phone.imei2)}</div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-muted-foreground">PTA Status</div>
              <div className="mt-1 text-sm font-medium">{text(phone.pta_status) || "N/A"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Condition Grade</div>
              <div className="mt-1 text-sm font-medium">{text(phone.condition_grade) || "N/A"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Purchase Date</div>
              <div className="mt-1 text-sm font-medium">{formatDateTime(phone.purchase_date)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Supplier / Source</div>
              <div className="mt-1 text-sm font-medium">{text(phone.supplier_name) || "N/A"}</div>
            </div>
            {phone.purchase_cost != null && (
              <div>
                <div className="text-xs text-muted-foreground">Purchase Cost</div>
                <div className="mt-1 text-sm font-medium">{money(phone.purchase_cost)}</div>
              </div>
            )}
            {phone.prep_cost != null && Number(phone.prep_cost) > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Prep / Refurb Cost</div>
                <div className="mt-1 text-sm font-medium">{money(phone.prep_cost)}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground">Box & Charger</div>
              <div className="mt-1 text-sm font-medium">
                {phone.box_included ? "Box Included" : "No Box"} · {phone.charger_included ? "Charger Included" : "No Charger"}
              </div>
            </div>
          </div>
          {phone.notes ? (
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
              <span className="font-medium text-muted-foreground">Notes: </span>
              {text(phone.notes)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 font-medium">Sale & Customer Information</h2>
        {sale ? (
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Invoice No</div>
                  <div className="mt-1 font-semibold text-primary">{text(sale.invoice_no)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sale Date</div>
                  <div className="mt-1 text-sm">{formatDateTime(sale.date)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="mt-1 text-sm font-medium">{text(sale.customer) || "Walk-in customer"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Customer Phone</div>
                  <div className="mt-1 text-sm">{text(sale.customer_phone) || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sale Total</div>
                  <div className="mt-1 text-base font-semibold">{money(sale.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Amount Paid</div>
                  <div className="mt-1 text-base font-semibold">{money(sale.paid)}</div>
                </div>
                {Number(sale.discount) > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Discount Applied</div>
                    <div className="mt-1 text-base font-semibold text-emerald-600">-{money(sale.discount)}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Payment Status</div>
                  <div className="mt-1 text-sm font-medium capitalize">{text(sale.status)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            This phone has not been sold yet (currently in available inventory).
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-medium">Warranty Claims</h2>
        {warranty.length ? (
          <Grid rows={warranty} columns={["date", "issue", "status", "action", "result"]} />
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No warranty claims on record for this handset.
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-medium">Repairs</h2>
        {repairs.length ? (
          <Grid rows={repairs} columns={["job_no", "fault", "status", "labor_charge", "date"]} />
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No repair jobs on record for this handset.
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 font-medium">Stock Movements</h2>
        {movements.length ? (
          <Grid rows={movements} columns={["date", "reason", "delta"]} />
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            No stock movements recorded for this handset.
          </div>
        )}
      </div>
    </div>
  );
}

function SearchPanel({
  kind,
  term,
  setTerm,
  request,
}: {
  kind: "history" | "search";
  term: string;
  setTerm: (x: string) => void;
  request: <T>(method: string, path: string, body?: Row) => Promise<T>;
}) {
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          request<Row>(
            "GET",
            `${kind === "history" ? "phone-history?imei" : "search?q"}=${encodeURIComponent(term)}`,
          )
            .then(setResult)
            .catch((e) => setError(String(e)));
        }}
        className="flex max-w-xl gap-2"
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={
            kind === "history"
              ? "Enter IMEI"
              : "Search product, IMEI, customer or invoice"
          }
        />
        <Button type="submit">Search</Button>
      </form>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {result &&
        (kind === "history" ? (
          <ImeiHistoryView result={result} />
        ) : (
          <div className="space-y-6">
            {(["products", "phones", "sales", "contacts"] as const).map(
              (key) => (
                <div key={key}>
                  <h2 className="mb-2 font-medium capitalize">{key}</h2>
                  <Grid
                    rows={(result[key] as Row[]) ?? []}
                    columns={
                      key === "products"
                        ? ["name", "category", "price", "quantity"]
                        : key === "phones"
                          ? ["product_name", "imei1", "status"]
                          : key === "sales"
                            ? ["invoice_no", "customer", "total", "paid"]
                            : ["name", "kind", "phone", "address"]
                    }
                  />
                </div>
              ),
            )}
          </div>
        ))}
    </div>
  );
}
export default App;
