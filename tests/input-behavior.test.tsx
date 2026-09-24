import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchSelect } from "../src/components/ui/search-select";
import { Input } from "../src/components/ui/input";

afterEach(() => cleanup());

describe("selection popovers", () => {
  it("closes a searchable dropdown when an option is picked", async () => {
    function Example() {
      const [value, setValue] = useState("");
      return (
        <SearchSelect
          id="supplier"
          value={value}
          onChange={setValue}
          placeholder="Search supplier"
          options={[{ value: "1", label: "Parts Hub" }, { value: "2", label: "Tech Distributors" }]}
        />
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const combo = screen.getByRole("combobox");
    await user.click(combo);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Parts Hub" }));
    expect(combo).toHaveValue("Parts Hub");
    expect(combo).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combo).not.toHaveFocus();
  });

  it("blurs a date input after a complete date is selected", async () => {
    function Example() {
      const [date, setDate] = useState("");
      return <Input aria-label="From" type="date" value={date} onChange={(event) => setDate(event.target.value)} />;
    }
    render(<Example />);
    const input = screen.getByLabelText("From");
    input.focus();
    fireEvent.change(input, { target: { value: "2026-09-23" } });
    expect(input).toHaveValue("2026-09-23");
    await waitFor(() => expect(input).not.toHaveFocus());
  });
});
