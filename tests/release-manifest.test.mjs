import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("release manifest sends every installed package type to its signed update", () => {
  const root = mkdtempSync(join(tmpdir(), "mobile-shop-release-test-"));
  const input = join(root, "input");
  const output = join(root, "output");
  const policyPath = join(root, "release-policy.json");
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const fixture = {
    "linux-x64": ["AppImage", "deb"],
    "windows-x64": ["exe", "msi"],
    "macos-arm64": ["app.tar.gz", "dmg"],
    "macos-x64": ["app.tar.gz", "dmg"],
  };
  try {
    writeFileSync(policyPath, JSON.stringify({ version, critical: true, minimum_version: version, notes: "Urgent inventory fix" }));
    for (const [platform, extensions] of Object.entries(fixture)) {
      const directory = join(input, `release-${platform}`);
      mkdirSync(directory, { recursive: true });
      for (const extension of extensions) {
        const filename = extension === "app.tar.gz"
          ? "Mobile Shop ERP.app.tar.gz"
          : `Mobile Shop ERP_${version}_${platform}.${extension}`;
        const path = join(directory, filename);
        writeFileSync(path, "fixture package");
        if (extension !== "dmg") writeFileSync(`${path}.sig`, `signature-for-${platform}-${extension}`);
      }
    }
    const result = spawnSync(process.execPath, ["scripts/create-update-manifest.mjs", input, output], {
      encoding: "utf8",
      env: { ...process.env, MOBILE_SHOP_RELEASE_POLICY: policyPath },
    });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(readFileSync(join(output, "latest.json"), "utf8"));
    assert.equal(manifest.version, version);
    assert.equal(manifest.critical, true);
    assert.equal(manifest.minimum_version, version);
    assert.equal(manifest.notes, "Urgent inventory fix");
    assert.deepEqual(Object.keys(manifest.platforms).sort(), [
      "darwin-aarch64-app", "darwin-x86_64-app", "linux-x86_64-appimage",
      "linux-x86_64-deb", "windows-x86_64-msi", "windows-x86_64-nsis",
    ].sort());
    assert.match(manifest.platforms["windows-x86_64-msi"].url, /windows-x64-.*\.msi$/);
    assert.match(manifest.platforms["linux-x86_64-deb"].url, /linux-x64-.*\.deb$/);
    assert.match(manifest.platforms["darwin-aarch64-app"].url, /macos-arm64-.*\.app\.tar\.gz$/);
    assert.equal(readdirSync(output).length, 15);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
