import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { UpdateCenter } from "../src/components/updates/UpdateCenter";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  localStorage.clear();
  mockInvoke.mockReset();
});
afterEach(() => cleanup());

function mount() {
  return render(<div id="shop-app-shell"><button>Shop action</button><UpdateCenter /></div>);
}

describe("release notifications", () => {
  it("shows a normal update outside settings and installs on request", async () => {
    mockInvoke.mockImplementation(async (command) => {
      if (command === "check_updates") return { configured: true, available: true, version: "0.3.2", critical: false, notes: "Improvements" };
      if (command === "install_update") return undefined;
      throw new Error(`Unexpected ${command}`);
    });
    mount();
    expect(await screen.findByText(/Update 0.3.2 is available/)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Install signed update" }));
    expect(mockInvoke).toHaveBeenCalledWith("install_update");
  });

  it("automatically installs a critical release and blocks the shop when installation fails", async () => {
    let installAttempts = 0;
    mockInvoke.mockImplementation(async (command) => {
      if (command === "app_version") return "0.3.1";
      if (command === "check_updates") return { configured: true, available: true, version: "0.3.2", critical: true, notes: "Critical repair" };
      if (command === "install_update") {
        installAttempts += 1;
        if (installAttempts === 1) throw new Error("Network unavailable");
        return undefined;
      }
      throw new Error(`Unexpected ${command}`);
    });
    mount();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Update to version 0.3.2");
    await waitFor(() => expect(screen.getByText(/Update installation failed/)).toBeInTheDocument());
    expect(document.getElementById("shop-app-shell")?.inert).toBe(true);
    expect(localStorage.getItem("shop-required-update")).toBe("0.3.2");
    expect(mockInvoke).toHaveBeenCalledWith("install_update");
    await userEvent.click(screen.getByRole("button", { name: "Retry required update" }));
    await waitFor(() => expect(installAttempts).toBe(2));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("keeps a known critical update mandatory when the feed cannot be reached", async () => {
    localStorage.setItem("shop-required-update", "0.3.2");
    mockInvoke.mockImplementation(async (command) => {
      if (command === "app_version") return "0.3.1";
      if (command === "check_updates") throw new Error("Offline");
      throw new Error(`Unexpected ${command}`);
    });
    mount();
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Cannot check the required update/)).toBeInTheDocument());
    expect(document.getElementById("shop-app-shell")?.inert).toBe(true);
  });

  it("forces an old installation to update even after a newer routine release replaces the critical one", async () => {
    mockInvoke.mockImplementation(async (command) => {
      if (command === "check_updates") return {
        configured: true, available: true, version: "0.3.4", current_version: "0.3.1",
        critical: false, minimum_version: "0.3.2",
      };
      if (command === "install_update") throw new Error("Installer unavailable");
      throw new Error(`Unexpected ${command}`);
    });
    mount();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Update to version 0.3.2");
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("install_update"));
    expect(localStorage.getItem("shop-required-update")).toBe("0.3.2");
  });

  it("unblocks the shop after the required version is installed", async () => {
    localStorage.setItem("shop-required-update", "0.3.2");
    mockInvoke.mockImplementation(async (command) => {
      if (command === "app_version") return "0.3.2";
      if (command === "check_updates") return { configured: true, available: false };
      throw new Error(`Unexpected ${command}`);
    });
    mount();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(localStorage.getItem("shop-required-update")).toBeNull();
    expect(document.getElementById("shop-app-shell")?.inert).toBe(false);
  });
});
