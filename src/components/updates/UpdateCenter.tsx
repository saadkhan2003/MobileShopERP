import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../ui/button";

const REQUIRED_VERSION_KEY = "shop-required-update";
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

type UpdateStatus = {
  configured: boolean;
  available?: boolean;
  version?: string;
  current_version?: string;
  minimum_version?: string | null;
  notes?: string | null;
  critical?: boolean;
};

function versionAtLeast(current: string, required: string) {
  return current.localeCompare(required, undefined, { numeric: true, sensitivity: "base" }) >= 0;
}

export function UpdateCenter() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [requiredVersion, setRequiredVersion] = useState(() => localStorage.getItem(REQUIRED_VERSION_KEY) || "");
  const [installing, setInstalling] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);
  const [error, setError] = useState("");
  const requiredRef = useRef(requiredVersion);
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const lastCheckRef = useRef(0);

  const requireVersion = useCallback((version: string) => {
    if (requiredRef.current && versionAtLeast(requiredRef.current, version)) return;
    requiredRef.current = version;
    localStorage.setItem(REQUIRED_VERSION_KEY, version);
    setRequiredVersion(version);
  }, []);

  const install = useCallback(async () => {
    if (installingRef.current) return;
    installingRef.current = true;
    setInstalling(true);
    setError("");
    try {
      await invoke("install_update");
      // The Rust command restarts the app; Windows exits into its installer.
    } catch (cause) {
      setError(`Update installation failed: ${String(cause)}`);
    } finally {
      installingRef.current = false;
      setInstalling(false);
    }
  }, []);

  const check = useCallback(async () => {
    if (checkingRef.current || installingRef.current) return;
    checkingRef.current = true;
    lastCheckRef.current = Date.now();
    try {
      if (requiredRef.current) {
        const currentVersion = await invoke<string>("app_version");
        if (versionAtLeast(currentVersion, requiredRef.current)) {
          localStorage.removeItem(REQUIRED_VERSION_KEY);
          requiredRef.current = "";
          setRequiredVersion("");
        }
      }
      const result = await invoke<UpdateStatus>("check_updates");
      setUpdate(result);
      const belowMinimum = Boolean(result.current_version && result.minimum_version && !versionAtLeast(result.current_version, result.minimum_version));
      if (result.available && result.version && (result.critical || belowMinimum || requiredRef.current)) {
        if (result.critical) requireVersion(result.version);
        else if (belowMinimum && result.minimum_version) requireVersion(result.minimum_version);
        await install();
      }
    } catch (cause) {
      if (requiredRef.current) setError(`Cannot check the required update: ${String(cause)}`);
    } finally {
      checkingRef.current = false;
      setInitialCheck(false);
    }
  }, [install, requireVersion]);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onFocus = () => {
      if (Date.now() - lastCheckRef.current >= 5 * 60 * 1000) void check();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  useEffect(() => {
    const shell = document.getElementById("shop-app-shell");
    if (shell) shell.inert = Boolean(requiredVersion || initialCheck);
    return () => { if (shell) shell.inert = false; };
  }, [requiredVersion, initialCheck]);

  const checkingScreen = initialCheck && !requiredVersion && createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6" role="status">
      <div className="rounded-xl border bg-card px-6 py-5 text-sm shadow-lg">Checking for shop updates…</div>
    </div>,
    document.body,
  );

  const criticalScreen = requiredVersion && createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="required-update-title">
      <div className="w-full max-w-md rounded-xl border bg-card p-7 shadow-xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Required update</p>
        <h1 id="required-update-title" className="text-2xl font-bold">Update to version {requiredVersion}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your installed version requires an update. Shop operations will resume after the signed update is installed.</p>
        {update?.notes && <p className="mt-3 text-sm">{update.notes}</p>}
        <p className="mt-4 text-sm font-medium" role="status">{installing ? "Installing the signed update…" : "The update is required before continuing."}</p>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        {!installing && <Button className="mt-5 w-full" onClick={() => void check()}>Retry required update</Button>}
      </div>
    </div>,
    document.body,
  );

  return <>
    {update?.available && !requiredVersion && <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
      <div><strong>Update {update.version} is available.</strong>{update.notes && <span className="ml-2">{update.notes}</span>}</div>
      <Button disabled={installing} onClick={() => void install()}>{installing ? "Installing…" : "Install signed update"}</Button>
      {error && <p className="w-full text-red-700" role="alert">{error}</p>}
    </div>}
    {criticalScreen}
    {checkingScreen}
  </>;
}
