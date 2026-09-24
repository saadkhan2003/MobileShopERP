import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const input = process.argv[2] || "release-input";
const output = process.argv[3] || "release-output";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const policy = JSON.parse(readFileSync(process.env.MOBILE_SHOP_RELEASE_POLICY || "release-policy.json", "utf8"));
if (policy.version !== version || typeof policy.critical !== "boolean" || typeof policy.notes !== "string"
  || typeof policy.minimum_version !== "string" || !/^\d+\.\d+\.\d+$/.test(policy.minimum_version)) {
  throw new Error("release-policy.json must match the app version and declare critical, minimum_version, and notes");
}
const minimumParts = policy.minimum_version.split(".").map(Number);
const releaseParts = version.split(".").map(Number);
const firstDifference = minimumParts.findIndex((part, index) => part !== releaseParts[index]);
const minimumAboveRelease = firstDifference >= 0 && minimumParts[firstDifference] > releaseParts[firstDifference];
if (minimumAboveRelease || (policy.critical && policy.minimum_version !== version)) {
  throw new Error("A critical release must set minimum_version to its version, and the minimum cannot exceed the release version");
}
const repository = process.env.MOBILE_SHOP_RELEASE_REPOSITORY || "saadkhan2003/MobileShopERP";
const base = `https://github.com/${repository}/releases/download/v${version}`;
const platforms = {};
const copied = new Set();

const expected = {
  "linux-x64": [
    { suffix: ".AppImage", key: "linux-x86_64-appimage" },
    { suffix: ".deb", key: "linux-x86_64-deb" },
  ],
  "windows-x64": [
    { suffix: ".exe", key: "windows-x86_64-nsis" },
    { suffix: ".msi", key: "windows-x86_64-msi" },
  ],
  "macos-arm64": [
    { suffix: ".app.tar.gz", key: "darwin-aarch64-app" },
    { suffix: ".dmg" },
  ],
  "macos-x64": [
    { suffix: ".app.tar.gz", key: "darwin-x86_64-app" },
    { suffix: ".dmg" },
  ],
};

function filesBelow(directory) {
  if (!existsSync(directory)) throw new Error(`Missing build artifact directory: ${directory}`);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : [];
  });
}

function releaseName(platform, path) {
  return `${platform}-${basename(path).replaceAll(" ", ".")}`;
}

function copyArtifact(platform, path) {
  const name = releaseName(platform, path);
  if (copied.has(name)) throw new Error(`Duplicate release asset: ${name}`);
  copied.add(name);
  copyFileSync(path, join(output, name));
  return `${base}/${encodeURIComponent(name)}`;
}

mkdirSync(output, { recursive: true });
for (const [platform, assets] of Object.entries(expected)) {
  const files = filesBelow(join(input, `release-${platform}`));
  for (const asset of assets) {
    const matches = files.filter((path) => path.endsWith(asset.suffix) && !path.endsWith(".sig"));
    if (matches.length !== 1) throw new Error(`Expected one ${platform} ${asset.suffix} artifact, found ${matches.length}`);
    const path = matches[0];
    // Tauri names the macOS updater archive after the app, without its version.
    const versionlessMacUpdater = platform.startsWith("macos-") && asset.suffix === ".app.tar.gz";
    if ((!versionlessMacUpdater && !basename(path).includes(version)) || statSync(path).size === 0) {
      throw new Error(`Invalid or empty release asset: ${path}`);
    }
    const url = copyArtifact(platform, path);
    if (asset.key) {
      const signaturePath = `${path}.sig`;
      if (!files.includes(signaturePath)) throw new Error(`Missing updater signature: ${signaturePath}`);
      const signature = readFileSync(signaturePath, "utf8").trim();
      if (!signature) throw new Error(`Empty updater signature: ${signaturePath}`);
      copyArtifact(platform, signaturePath);
      platforms[asset.key] = { url, signature };
    }
  }
}

const manifest = { version, notes: policy.notes || `Mobile Shop ERP ${version}`, critical: policy.critical, minimum_version: policy.minimum_version, platforms };
writeFileSync(join(output, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Prepared ${copied.size} release assets and ${Object.keys(platforms).length} signed updater targets in ${output}\n`);
