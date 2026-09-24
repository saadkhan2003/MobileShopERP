import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const endpoint = process.env.MOBILE_SHOP_UPDATE_URL;
const privatePath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;
const publicPath = process.env.MOBILE_SHOP_UPDATE_PUBLIC_KEY_PATH;
if (!endpoint?.startsWith("https://") || !privatePath || !publicPath) {
  throw new Error("Set MOBILE_SHOP_UPDATE_URL (HTTPS), TAURI_SIGNING_PRIVATE_KEY_PATH, and MOBILE_SHOP_UPDATE_PUBLIC_KEY_PATH");
}
const publicKey = readFileSync(publicPath, "utf8").trim();
const privateKey = readFileSync(privatePath, "utf8").trim();
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
  const result = spawnSync("npm", ["run", "tauri", "build", "--", "--config", configPath], {
    stdio: "inherit",
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: privateKey, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "", MOBILE_SHOP_UPDATE_PUBLIC_KEY: publicKey, MOBILE_SHOP_UPDATE_URL: endpoint },
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
