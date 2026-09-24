import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { ShopSettings } from "../components/settings/GlobalSettings";

type Row = Record<string, unknown>;
const clean = (value: unknown) => String(value ?? "").replace(/[^\x20-\x7E]/g, "?");
const currency = (value: unknown) => `Rs ${Number(value ?? 0).toFixed(2)}`;

async function documentBase(settings: ShopSettings, title: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 795;
  if (settings.logo_data) {
    try {
      const data = settings.logo_data.split(",")[1];
      const image = settings.logo_data.startsWith("data:image/png")
        ? await doc.embedPng(data)
        : settings.logo_data.startsWith("data:image/jpeg")
          ? await doc.embedJpg(data)
          : null;
      if (image) page.drawImage(image, { x: 48, y: y - 18, width: 42, height: 42 });
    } catch { /* A bad logo must not prevent a receipt. */ }
  }
  page.drawText(clean(settings.shop_name).slice(0, 55), { x: 105, y, font: bold, size: 18, color: rgb(0.02, 0.42, 0.31) });
  y -= 22;
  page.drawText(clean(settings.address).slice(0, 90), { x: 105, y, font, size: 9 });
  y -= 14;
  page.drawText(clean(settings.phone).slice(0, 70), { x: 105, y, font, size: 9 });
  y -= 35;
  page.drawText(title, { x: 48, y, font: bold, size: 16 });
  y -= 25;
  return { doc, page, font, bold, y };
}

function line(page: PDFPage, font: PDFFont, label: string, value: unknown, y: number, x = 48) {
  page.drawText(`${label}: ${clean(value).slice(0, 82)}`, { x, y, font, size: 10 });
  return y - 18;
}

async function persist(doc: PDFDocument, suggestedName: string) {
  const path = await save({ defaultPath: suggestedName, filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (!path) return false;
  const bytes = await doc.save();
  await invoke("save_pdf", { path, bytes: Array.from(bytes) });
  return true;
}

export async function saveInvoicePdf(sale: Row, settings: ShopSettings) {
  const { doc, page, font, bold } = await documentBase(settings, "SALES INVOICE");
  let currentPage = page;
  let y = 680;
  y = line(currentPage, font, "Invoice", sale.invoice_no, y);
  y = line(currentPage, font, "Date", sale.date, y);
  y = line(currentPage, font, "Customer", sale.customer || "Walk-in", y);
  y = line(currentPage, font, "Phone", sale.customer_phone, y) - 12;
  currentPage.drawText("Item", { x: 48, y, font: bold, size: 10 });
  currentPage.drawText("IMEI", { x: 285, y, font: bold, size: 10 });
  currentPage.drawText("Qty", { x: 425, y, font: bold, size: 10 });
  currentPage.drawText("Price", { x: 465, y, font: bold, size: 10 });
  y -= 20;
  for (const item of (sale.lines as Row[] | undefined) ?? []) {
    if (y < 160) {
      currentPage = doc.addPage([595, 842]);
      y = 790;
      currentPage.drawText(`Invoice ${clean(sale.invoice_no)} (continued)`, { x: 48, y, font: bold, size: 12 });
      y -= 30;
    }
    currentPage.drawText(clean(item.description).slice(0, 38), { x: 48, y, font, size: 9 });
    currentPage.drawText(clean(item.imei1).slice(0, 16), { x: 285, y, font, size: 9 });
    currentPage.drawText(clean(item.quantity), { x: 425, y, font, size: 9 });
    currentPage.drawText(currency(item.unit_price), { x: 465, y, font, size: 9 });
    y -= 17;
  }
  if (y < 190) { currentPage = doc.addPage([595, 842]); y = 790; }
  y -= 12;
  y = line(currentPage, font, "Subtotal", currency(sale.subtotal), y);
  y = line(currentPage, font, "Discount", currency(sale.discount), y);
  const returns = (sale.returns as Row[] | undefined) ?? [];
  if (returns.length) y = line(currentPage, font, "Returns", currency(returns.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)), y);
  y = line(currentPage, bold, "Net total", currency(sale.total), y);
  y = line(currentPage, font, "Net paid", currency(sale.paid), y);
  line(currentPage, font, "Balance", currency(Number(sale.total ?? 0) - Number(sale.paid ?? 0)), y);
  currentPage.drawText(clean(settings.receipt_footer).slice(0, 95), { x: 48, y: 65, font, size: 9 });
  return persist(doc, `${clean(sale.invoice_no) || "invoice"}.pdf`);
}

export async function saveRepairPdf(repair: Row, settings: ShopSettings) {
  const { doc, page, font, bold } = await documentBase(settings, "REPAIR JOB CARD");
  let y = 680;
  const fields: [string, unknown][] = [
    ["Job", repair.job_no], ["Received", repair.date], ["Customer", repair.customer],
    ["Phone", repair.phone], ["Model", repair.model], ["IMEI", repair.imei],
    ["Fault", repair.fault], ["Condition", repair.condition_notes],
    ["Accessories", repair.received_accessories], ["Expected", repair.expected_date],
    ["Status", repair.status], ["Labor", currency(repair.labor_charge)],
  ];
  for (const [label, value] of fields) y = line(page, font, label, value, y);
  y -= 35;
  page.drawText("Customer signature: __________________________", { x: 48, y, font: bold, size: 10 });
  page.drawText(clean(settings.receipt_footer).slice(0, 95), { x: 48, y: 65, font, size: 9 });
  return persist(doc, `${clean(repair.job_no) || "repair"}.pdf`);
}
