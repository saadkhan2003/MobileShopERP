import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: unknown): string {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  // Pure calendar date (YYYY-MM-DD): leave intact so dates don't shift by timezone offset
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Match SQLite CURRENT_TIMESTAMP "YYYY-MM-DD HH:MM:SS" or ISO timestamp strings
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    const hasTz = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s);
    // SQLite timestamps are stored in UTC; if no offset is present, treat as UTC
    const iso = hasTz ? s : `${m[1]}T${m[2]}Z`;
    const date = new Date(iso);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }
  return s;
}
