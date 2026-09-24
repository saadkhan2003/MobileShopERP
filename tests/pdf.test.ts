import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { saveInvoicePdf, saveRepairPdf } from "../src/lib/pdf";
import { DEFAULT_SHOP_SETTINGS } from "../src/components/settings/GlobalSettings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
beforeEach(() => { vi.mocked(invoke).mockReset(); vi.mocked(save).mockReset(); vi.mocked(save).mockResolvedValue("/tmp/test-document.pdf"); });

describe("PDF documents", () => {
  it("saves every invoice line across pages", async () => {
    const lines = Array.from({ length: 55 }, (_, index) => ({ description: `Charger ${index + 1}`, quantity: 1, unit_price: 100 }));
    await saveInvoicePdf({ invoice_no: "INV-55", date: "2026-09-23", lines, subtotal: 5500, total: 5500, paid: 5500 }, DEFAULT_SHOP_SETTINGS);
    const bytes = (vi.mocked(invoke).mock.calls[0][1] as { bytes: number[] }).bytes;
    const pdf = await PDFDocument.load(new Uint8Array(bytes));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });
  it("saves a repair job card", async () => {
    await saveRepairPdf({ job_no: "JOB-9", customer: "Sara", model: "Galaxy A55", fault: "Screen" }, DEFAULT_SHOP_SETTINGS);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: "JOB-9.pdf" }));
    expect(invoke).toHaveBeenCalledWith("save_pdf", expect.objectContaining({ path: "/tmp/test-document.pdf" }));
  });
});
