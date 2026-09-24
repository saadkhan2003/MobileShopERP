import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SearchOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

type SearchSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder: string;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
};

export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  required = false,
  disabled = false,
}: SearchSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return options.slice(0, 80);
    return options
      .filter((option) =>
        `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`
          .toLocaleLowerCase()
          .includes(term),
      )
      .slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    input.current?.setCustomValidity(
      required && !value ? "Choose an item from the list" : "",
    );
  }, [required, value]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  const choose = (option: SearchOption) => {
    onChange(option.value);
    setQuery("");
    setOpen(false);
    setActive(0);
    input.current?.blur();
  };

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-2.5 transition-colors focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15">
        <Search
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <input
          ref={input}
          id={id}
          aria-label={ariaLabel}
          role="combobox"
          aria-controls={`${id}-options`}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[active] ? `${id}-option-${active}` : undefined
          }
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={open ? query : (selected?.label ?? "")}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onFocus={() => {
            setQuery("");
            setActive(0);
            setOpen(true);
          }}
          onChange={(event) => {
            if (value) onChange("");
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, filtered.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open && filtered[active]) {
              event.preventDefault();
              choose(filtered[active]);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label={`Clear ${placeholder.toLowerCase()}`}
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
              input.current?.focus();
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        )}
      </div>
      {open && !disabled && (
        <div
          id={`${id}-options`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-card p-1 shadow-xl"
        >
          {filtered.length ? (
            filtered.map((option, index) => (
              <button
                key={option.value}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onPointerDown={(event) => event.preventDefault()}
                onPointerUp={() => choose(option)}
                onClick={(event) => {
                  // Keyboard and assistive-technology clicks do not fire pointerup.
                  if (event.detail === 0) choose(option);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${active === index ? "bg-emerald-50 text-emerald-900" : "hover:bg-muted"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
                {option.value === value && (
                  <Check className="size-4 text-emerald-600" />
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No matches found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
