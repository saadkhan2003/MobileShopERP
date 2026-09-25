import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import defaultShopLogo from "../../assets/stack-and-scale-icon.png";

export type ShopSettings = {
  shop_name: string;
  tagline: string;
  logo_data: string;
  phone: string;
  address: string;
  receipt_footer: string;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shop_name: "Mobile Shop",
  tagline: "Desktop ERP",
  logo_data: "",
  phone: "",
  address: "",
  receipt_footer: "Thank you for shopping with us.",
};

export function normalizeShopSettings(value: unknown): ShopSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_SHOP_SETTINGS;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(DEFAULT_SHOP_SETTINGS).map(([key, fallback]) => [
      key,
      typeof source[key] === "string" ? source[key] : fallback,
    ]),
  ) as ShopSettings;
}

export function ShopLogo({
  settings,
  className = "size-8",
}: {
  settings: ShopSettings;
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 ${className}`}>
      {settings.logo_data ? (
        <img src={settings.logo_data} alt="Shop logo" className="size-full object-contain bg-white" />
      ) : (
        <img src={defaultShopLogo} alt={settings.shop_name || "Mobile Shop ERP"} className="size-full object-contain p-0.5" />
      )}
    </div>
  );
}

export function GlobalSettings({
  settings,
  save,
}: {
  settings: ShopSettings;
  save: (next: ShopSettings) => Promise<ShopSettings>;
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setDraft(settings), [settings]);

  const update = (key: keyof ShopSettings, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1_000_000) {
      setError("Choose a PNG, JPEG or WebP image under 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update("logo_data", reader.result);
        setError("");
      }
    };
    reader.onerror = () => setError("Could not read the logo file.");
    reader.readAsDataURL(file);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await save({ ...draft, shop_name: draft.shop_name.trim(), tagline: draft.tagline.trim() });
      setDraft(saved);
      setMessage("Shop settings saved.");
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Shop identity</CardTitle>
          <p className="text-sm text-muted-foreground">Shown in the app and on printed sales documents.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-shop-name">Shop name</Label>
                <Input id="settings-shop-name" required maxLength={80} value={draft.shop_name} onChange={(event) => update("shop_name", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-tagline">Tagline</Label>
                <Input id="settings-tagline" maxLength={80} value={draft.tagline} onChange={(event) => update("tagline", event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-logo">Shop logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                <ShopLogo settings={draft} className="size-14" />
                <label htmlFor="settings-logo" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
                  <Upload className="size-4" /> Choose image
                </label>
                <input id="settings-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="sr-only" />
                {draft.logo_data && <Button type="button" variant="outline" onClick={() => update("logo_data", "")}>Remove logo</Button>}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 1 MB. The image is saved in the local shop database.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-phone">Shop phone</Label>
                <Input id="settings-phone" maxLength={80} value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-address">Shop address</Label>
                <Input id="settings-address" maxLength={250} value={draft.address} onChange={(event) => update("address", event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-receipt-footer">Receipt footer</Label>
              <Input id="settings-receipt-footer" maxLength={250} value={draft.receipt_footer} onChange={(event) => update("receipt_footer", event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border bg-sidebar p-3">
            <ShopLogo settings={draft} className="size-9" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{draft.shop_name || "Mobile Shop"}</div>
              <div className="truncate text-xs text-muted-foreground">{draft.tagline}</div>
            </div>
          </div>
          <div className="rounded-lg border p-4 text-center text-sm">
            <div className="font-bold">{draft.shop_name || "Mobile Shop"}</div>
            {draft.phone && <div>{draft.phone}</div>}
            {draft.address && <div>{draft.address}</div>}
            <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">{draft.receipt_footer}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
