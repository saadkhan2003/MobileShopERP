import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import App from "../src/App";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);
const owner = { id: 1, name: "Owner", role: "owner" };
const command = (
  path: string,
  method = "GET",
  data: Record<string, unknown> = {},
) => expect.objectContaining({ path, method, data });

beforeEach(() => {
  localStorage.clear();
  mockInvoke.mockReset();
});
afterEach(() => cleanup());

describe("desktop interface", () => {
  it("creates the first owner account", async () => {
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: true };
      if (req.path === "/api/setup") return { ok: true };
      throw new Error(`Unexpected ${req.path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Create the local owner account");
    await user.type(screen.getByLabelText("Name"), "Shop Owner");
    await user.type(screen.getByLabelText("Username"), "shop-owner");
    await user.type(screen.getByLabelText("Password"), "StrongPass123");
    await user.click(screen.getByRole("button", { name: "Create shop" }));
    await screen.findByText("Sign in to your desktop shop");
    expect(mockInvoke).toHaveBeenCalledWith(
      "api_request",
      command("/api/setup", "POST", {
        name: "Shop Owner",
        username: "shop-owner",
        password: "StrongPass123",
      }),
    );
  });
  it("signs in and displays dashboard metrics", async () => {
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/login")
        return { token: "test-token", user: owner };
      if (req.path === "/api/dashboard")
        return {
          salesToday: 1200,
          salesMonth: 5000,
          outstanding: 800,
          availablePhones: 3,
          lowStock: [],
          recentSales: [],
          repairsReady: 1,
          overdue: 0,
        };
      throw new Error(`Unexpected ${req.path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sign in to your desktop shop");
    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "StrongPass123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Sales today");
    expect(screen.getByText(/1,200/)).toBeInTheDocument();
    expect(localStorage.getItem("shop-token")).toBe("test-token");
  });
  it("saves shop identity and logo and updates the sidebar", async () => {
    localStorage.setItem("shop-token", "test-token");
    const original = {
      shop_name: "Mobile Shop", tagline: "Desktop ERP", logo_data: "",
      phone: "", address: "", receipt_footer: "Thank you for shopping with us.",
    };
    let saved = original;
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string; data: typeof original };
      if (req.path === "/api/status") return { setup: false, branding: original };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard") return { lowStock: [], recentSales: [] };
      if (req.path === "/api/settings" && req.method === "PUT") {
        saved = req.data;
        return saved;
      }
      if (req.path === "/api/settings") return saved;
      throw new Error(`Unexpected ${req.path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(within(screen.getByRole("navigation", { name: "Shop modules" })).getByRole("button", { name: "Global settings" }));
    await screen.findByRole("heading", { name: "Global settings" });
    await user.clear(screen.getByLabelText("Shop name"));
    await user.type(screen.getByLabelText("Shop name"), "Saad Mobile Center");
    const logo = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "logo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Shop logo"), logo);
    await waitFor(() => expect(screen.getAllByAltText("Shop logo").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    await screen.findByText("Shop settings saved.");
    expect(saved.shop_name).toBe("Saad Mobile Center");
    expect(saved.logo_data).toMatch(/^data:image\/png;base64,/);
    expect(within(screen.getByTestId("shop-sidebar")).getByText("Saad Mobile Center")).toBeInTheDocument();
  });
  it("collapses to a usable icon rail and restores the menu and preference", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return {
          salesToday: 0, salesMonth: 0, outstanding: 0, availablePhones: 0,
          lowStock: [], recentSales: [], repairsReady: 0, overdue: 0,
        };
      if (req.path === "/api/products") return [];
      throw new Error(`Unexpected ${req.path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    const sidebar = screen.getByTestId("shop-sidebar");
    expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await user.click(screen.getByRole("button", { name: "Inventory" }));
    expect(screen.getByRole("button", { name: "Inventory" })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect(localStorage.getItem("shop-sidebar-collapsed")).toBe("true");
    const nav = within(screen.getByRole("navigation", { name: "Shop modules" }));
    await user.click(nav.getByRole("button", { name: "Products & stock" }));
    await screen.findByRole("heading", { name: "Products & stock" });
    expect(nav.getByRole("button", { name: "Products & stock" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(sidebar).toHaveAttribute("data-collapsed", "false");
    expect(localStorage.getItem("shop-sidebar-collapsed")).toBe("false");
    expect(nav.getByRole("button", { name: "Inventory" })).toHaveAttribute("aria-expanded", "true");
  });
  it("opens inventory and submits a new charger", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return {
          salesToday: 0,
          salesMonth: 0,
          outstanding: 0,
          availablePhones: 0,
          lowStock: [],
          recentSales: [],
          repairsReady: 0,
          overdue: 0,
        };
      if (req.path === "/api/products" && req.method === "POST")
        return { id: 1 };
      if (
        [
          "/api/products",
          "/api/phones",
          "/api/contacts?kind=customer",
          "/api/contacts?kind=supplier",
        ].includes(req.path)
      )
        return [];
      throw new Error(`Unexpected ${req.path}`);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(screen.getByRole("button", { name: "Products & stock" }));
    await screen.findByRole("heading", { name: "Products & stock" });
    await user.click(screen.getByRole("button", { name: "Add new" }));
    await user.type(screen.getByLabelText("Product name"), "Demo Charger");
    await user.selectOptions(screen.getByLabelText("Category"), "charger");
    await user.type(screen.getByLabelText("Sale price"), "1800");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          method: "POST",
          path: "/api/products",
          data: expect.objectContaining({
            name: "Demo Charger",
            category: "charger",
            price: 1800,
          }),
        }),
      ),
    );
  });
  it("opens every owner navigation screen without a runtime error", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return {
          salesToday: 0,
          salesMonth: 0,
          outstanding: 0,
          availablePhones: 0,
          lowStock: [],
          recentSales: [],
          repairsReady: 0,
          overdue: 0,
        };
      if (req.path === "/api/reports")
        return {
          sales: [],
          categories: [],
          staff: [],
          slow: [],
          phoneProfit: [],
          stock: {},
          phoneStock: {},
          expenses: {},
        };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    const screens = [
      "Products & stock",
      "IMEI stock",
      "Purchases",
      "Used phone buys",
      "Sales & invoices",
      "Installments",
      "Repair jobs",
      "Warranty claims",
      "Customers",
      "Suppliers",
      "Customer & supplier ledger",
      "Payments",
      "Expenses",
      "Owner drawings",
      "Cash register",
      "Market rates",
      "Price history",
      "Reports",
      "IMEI history",
      "Search",
      "Staff",
      "Branches",
      "Global settings",
      "Backup & restore",
      "Audit trail",
    ];
    for (const title of screens) {
      await user.click(
        within(screen.getByRole("navigation")).getByRole("button", {
          name: title,
        }),
      );
      await screen.findByRole("heading", { name: title });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  });
  it("assigns a technician when creating a repair", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/contacts?kind=customer")
        return [{ id: 3, name: "Buyer" }];
      if (req.path === "/api/users")
        return [{ id: 7, name: "Ali Tech", role: "technician" }];
      if (req.path === "/api/repairs" && req.method === "POST")
        return { id: 9 };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Repair jobs",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add new" }));
    await user.click(screen.getByLabelText("Customer"));
    await user.click(await screen.findByRole("option", { name: /Buyer/ }));
    await user.click(screen.getByLabelText("Technician"));
    await user.click(await screen.findByRole("option", { name: /Ali Tech/ }));
    await user.type(screen.getByLabelText("Model"), "Galaxy A55");
    await user.type(screen.getByLabelText("Fault"), "Battery issue");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          method: "POST",
          path: "/api/repairs",
          data: expect.objectContaining({
            customer_id: "3",
            technician_id: "7",
            model: "Galaxy A55",
          }),
        }),
      ),
    );
  });
  it("sends multiple installment dates with the correct total", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/sales" && req.method === "GET")
        return [
          {
            id: 11,
            invoice_no: "INV-11",
            customer: "Buyer",
            customer_id: 3,
            total: 1000,
            paid: 100,
          },
        ];
      if (req.path === "/api/sales/11/installments" && req.method === "POST")
        return { ok: true };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Installments",
      }),
    );
    await user.click(await screen.findByLabelText("Credit sale"));
    await user.click(await screen.findByRole("option", { name: /INV-11/ }));
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2027-01-01" },
    });
    await user.type(screen.getByLabelText("Installment amount"), "400");
    await user.click(screen.getByRole("button", { name: "Add due date" }));
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2027-02-01" },
    });
    await user.type(screen.getByLabelText("Installment amount"), "500");
    await user.click(screen.getByRole("button", { name: "Add due date" }));
    await user.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          method: "POST",
          path: "/api/sales/11/installments",
          data: {
            entries: [
              { due_date: "2027-01-01", amount: 400 },
              { due_date: "2027-02-01", amount: 500 },
            ],
          },
        }),
      ),
    );
  });
  it("filters reports by date and shows fast moving stock", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/reports")
        return { from: "2026-09-01", to: "2026-09-23", fast: [] };
      if (req.path === "/api/reports?from=2026-09-10&to=2026-09-20")
        return {
          from: "2026-09-10",
          to: "2026-09-20",
          sales: [
            { day: "2026-09-10", count: 1, revenue: 3000, discounts: 0 },
            { day: "2026-09-20", count: 2, revenue: 8000, discounts: 0 },
          ],
          categories: [{ category: "charger", units: 8, revenue: 8000, gross_profit: 2400 }],
          staff: [{ name: "Owner", sales: 2, revenue: 8000, discounts: 0, collections: 8000 }],
          fast: [
            { id: 4, name: "USB-C Charger", units_sold: 8, revenue: 8000 },
          ],
        };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Reports",
      }),
    );
    fireEvent.change(await screen.findByLabelText("From"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-09-20" },
    });
    await user.click(screen.getByRole("button", { name: "Apply dates" }));
    await screen.findByRole("region", { name: "Report charts" });
    const charts = within(screen.getByRole("region", { name: "Report charts" }));
    expect(charts.getByText("Sales revenue trend")).toBeInTheDocument();
    expect(charts.getByRole("img", { name: /2026-09-10 to 2026-09-20/ })).toBeInTheDocument();
    expect(charts.getByText("charger")).toBeInTheDocument();
    expect(charts.getByText("USB-C Charger")).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith(
      "api_request",
      expect.objectContaining({
        path: "/api/reports?from=2026-09-10&to=2026-09-20",
      }),
    );
  });
  it("clears a customer ledger before switching to a supplier", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/contacts?kind=customer")
        return [{ id: 3, name: "Buyer" }];
      if (req.path === "/api/contacts?kind=supplier")
        return [{ id: 4, name: "Vendor" }];
      if (req.path === "/api/ledger?kind=customer&contact_id=3")
        return { balance: 1234, transactions: [], payments: [] };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Customer & supplier ledger",
      }),
    );
    await user.click(await screen.findByLabelText("Ledger contact"));
    await user.click(await screen.findByRole("option", { name: /Buyer/ }));
    await user.click(screen.getByRole("button", { name: "View ledger" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          path: "/api/ledger?kind=customer&contact_id=3",
        }),
      ),
    );
    await screen.findByText(/1,234/);
    await user.selectOptions(screen.getByLabelText("Ledger type"), "supplier");
    expect(screen.queryByText(/1,234/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ledger contact")).toHaveValue("");
  });
  it("saves a used phone and runs a search from their forms", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/products")
        return [
          { id: 5, name: "Galaxy A55", category: "phone", sku: "SAM-A55" },
          { id: 6, name: "iPhone 15", category: "phone", sku: "APL-15" },
        ];
      if (req.path === "/api/contacts?kind=customer")
        return [{ id: 3, name: "Buyer" }];
      if (req.path === "/api/used-purchases" && req.method === "POST")
        return { id: 6 };
      if (req.path === "/api/search?q=Galaxy")
        return {
          products: [{ id: 5, name: "Galaxy A55" }],
          phones: [],
          sales: [],
          contacts: [],
        };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Used phone buys",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add new" }));
    await user.click(screen.getByLabelText("Seller"));
    await user.click(await screen.findByRole("option", { name: /Buyer/ }));
    await user.type(screen.getByLabelText("Phone model"), "SAM-A55");
    expect(
      screen.queryByRole("option", { name: /iPhone 15/ }),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: /Galaxy A55/ }));
    await user.type(screen.getByLabelText("IMEI 1"), "900000000000123");
    await user.type(screen.getByLabelText("Touch"), "OK");
    await user.click(screen.getByLabelText("Box included"));
    await user.type(screen.getByLabelText("Agreed price"), "25000");
    await user.click(screen.getByRole("button", { name: "Save used phone" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          method: "POST",
          path: "/api/used-purchases",
          data: expect.objectContaining({
            checklist: expect.objectContaining({ touch: "OK" }),
            box_included: true,
          }),
        }),
      ),
    );
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Search",
      }),
    );
    await user.type(
      screen.getByPlaceholderText("Search product, IMEI, customer or invoice"),
      "Galaxy",
    );
    await user.click(
      within(screen.getByRole("main")).getByRole("button", { name: "Search" }),
    );
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({ path: "/api/search?q=Galaxy" }),
      ),
    );
  });
  it("saves product edits from the detail form", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/products" && req.method === "GET")
        return [
          {
            id: 5,
            name: "USB-C Charger",
            category: "charger",
            sku: "CH-5",
            price: 1500,
          },
        ];
      if (req.path === "/api/products/5" && req.method === "PATCH")
        return { ok: true };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Products & stock",
      }),
    );
    await user.click(
      await screen.findByRole("cell", { name: "USB-C Charger" }),
    );
    expect(
      screen.getByLabelText("Barcode CH-5").querySelectorAll("rect").length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Price")).toHaveValue(1500);
    expect(screen.getByLabelText("Name")).toHaveValue("USB-C Charger");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "1800");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          method: "PATCH",
          path: "/api/products/5",
          data: expect.objectContaining({ price: "1800" }),
        }),
      ),
    );
  });
  it("does not show records from a previous screen after rapid navigation", async () => {
    localStorage.setItem("shop-token", "test-token");
    let finishProducts: ((rows: unknown[]) => void) | undefined;
    let productReads = 0;
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/products") {
        productReads++;
        if (productReads === 1)
          return new Promise((resolve) => {
            finishProducts = resolve;
          });
        return [];
      }
      if (req.path === "/api/sales" && req.method === "GET")
        return [
          {
            id: 8,
            invoice_no: "INV-8",
            customer: "Buyer",
            total: 100,
            paid: 100,
          },
        ];
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Products & stock",
      }),
    );
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Sales & invoices",
      }),
    );
    await screen.findByText("INV-8");
    await act(async () => finishProducts?.([{ id: 9, name: "Old result" }]));
    expect(
      screen.getByRole("heading", { name: "Sales & invoices" }),
    ).toBeInTheDocument();
    expect(screen.getByText("INV-8")).toBeInTheDocument();
    expect(screen.queryByText("Old result")).not.toBeInTheDocument();
  });
  it("shows manager-only controls according to backend permissions", async () => {
    localStorage.setItem("shop-token", "manager-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me")
        return { id: 2, name: "Manager", role: "manager" };
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Staff",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Add new" }),
    ).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Market rates",
      }),
    );
    expect(screen.getByRole("button", { name: "Add new" })).toBeInTheDocument();
  });
  it("groups the menu and reveals phone entry cards after category selection", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    const nav = within(
      screen.getByRole("navigation", { name: "Shop modules" }),
    );
    const inventory = nav.getByRole("button", { name: "Inventory" });
    expect(inventory).toHaveAttribute("aria-expanded", "true");
    await user.click(inventory);
    expect(inventory).toHaveAttribute("aria-expanded", "false");
    expect(
      nav.queryByRole("button", { name: "Products & stock" }),
    ).not.toBeInTheDocument();
    await user.click(inventory);
    await user.click(nav.getByRole("button", { name: "Products & stock" }));
    await user.click(screen.getByRole("button", { name: "Add new" }));
    expect(screen.queryByText("Phone specifications")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Category"), "phone");
    const heading = await screen.findByText("Phone specifications");
    expect(heading.closest('[data-slot="card"]')).toHaveClass("entry-reveal");
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
  });
  it("reveals an IMEI card and saves a handset purchase", async () => {
    localStorage.setItem("shop-token", "test-token");
    mockInvoke.mockImplementation(async (_command, args) => {
      const req = args as { path: string; method: string };
      if (req.path === "/api/status") return { setup: false };
      if (req.path === "/api/me") return owner;
      if (req.path === "/api/dashboard")
        return { lowStock: [], recentSales: [] };
      if (req.path === "/api/products")
        return [
          {
            id: 5,
            name: "Galaxy A55",
            category: "phone",
            cost: 40000,
            price: 50000,
          },
        ];
      if (req.path === "/api/purchases" && req.method === "POST")
        return { id: 8 };
      return [];
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Sales today");
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: "Purchases",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add new" }));
    await user.type(screen.getByLabelText("Product"), "Galaxy");
    await user.click(await screen.findByRole("option", { name: /Galaxy A55/ }));
    const heading = await screen.findByText("Add an IMEI-tracked handset");
    expect(heading.closest('[data-slot="card"]')).toHaveClass("entry-reveal");
    await user.type(screen.getByLabelText("IMEI 1"), "900000000000567");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.click(screen.getByRole("button", { name: "Save purchase" }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith(
        "api_request",
        expect.objectContaining({
          path: "/api/purchases",
          method: "POST",
          data: expect.objectContaining({
            lines: [
              expect.objectContaining({
                product_id: 5,
                imeis: [expect.objectContaining({ imei1: "900000000000567" })],
              }),
            ],
          }),
        }),
      ),
    );
  });
});
