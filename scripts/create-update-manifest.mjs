import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.env.MOBILE_SHOP_RELEASE_BASE_URL;
if (!base?.startsWith("https://")) throw new Error("Set MOBILE_SHOP_RELEASE_BASE_URL to the HTTPS directory hosting the signed bundle");
const directory = "src-tauri/target/release/bundle/appimage";
const bundle = readdirSync(directory).find((name) => name.endsWith(".AppImage") && readdirSync(directory).includes(`${name}.sig`));
if (!bundle) throw new Error("Signed AppImage and .sig are required. Run npm run release:signed first.");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const signature = readFileSync(join(directory, `${bundle}.sig`), "utf8").trim();
const assetName = process.env.MOBILE_SHOP_RELEASE_ASSET_NAME || bundle;
if (assetName.includes("/") || assetName.includes("\\")) throw new Error("Asset name must not contain a path separator");
const url = `${base.replace(/\/$/, "")}/${encodeURIComponent(assetName)}`;
const manifest = { version, notes: "Mobile Shop ERP update", url, signature };
mkdirSync("release", { recursive: true });
writeFileSync("release/latest.json", `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write("Wrote release/latest.json. Publish it with the AppImage over HTTPS.\n");
