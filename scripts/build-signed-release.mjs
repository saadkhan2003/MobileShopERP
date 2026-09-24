import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const endpoint = process.env.MOBILE_SHOP_UPDATE_URL || "https://github.com/saadkhan2003/MobileShopERP/releases/latest/download/latest.json";
const privateKey = (process.env.MOBILE_SHOP_UPDATE_PRIVATE_KEY || (process.env.TAURI_SIGNING_PRIVATE_KEY_PATH && readFileSync(process.env.TAURI_SIGNING_PRIVATE_KEY_PATH, "utf8")) || "").trim();
const publicKey = (process.env.MOBILE_SHOP_UPDATE_PUBLIC_KEY || (process.env.MOBILE_SHOP_UPDATE_PUBLIC_KEY_PATH && readFileSync(process.env.MOBILE_SHOP_UPDATE_PUBLIC_KEY_PATH, "utf8")) || "").trim();
if (!endpoint.startsWith("https://")) throw new Error("MOBILE_SHOP_UPDATE_URL must be HTTPS");
if (!publicKey || !privateKey) throw new Error("Signing keys are empty");
const bundles = process.platform === "linux" ? ["deb", "appimage"] : process.platform === "darwin" ? ["app", "dmg"] : ["msi", "nsis"];
const config = {
  bundle: { createUpdaterArtifacts: true, targets: bundles },
  plugins: { updater: { pubkey: publicKey, endpoints: [endpoint] } },
};
const temp = mkdtempSync(join(tmpdir(), "mobile-shop-release-"));
const configPath = join(temp, "tauri-release.json");
writeFileSync(configPath, JSON.stringify(config));
try {
  const args = ["run", "tauri", "build", "--", "--ci", "--config", configPath];
  if (process.env.MOBILE_SHOP_BUILD_TARGET) args.push("--target", process.env.MOBILE_SHOP_BUILD_TARGET);
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this script with npm run release:signed");
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    stdio: "inherit",
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: privateKey, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "", MOBILE_SHOP_UPDATE_PUBLIC_KEY: publicKey, MOBILE_SHOP_UPDATE_URL: endpoint },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
