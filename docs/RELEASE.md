# Signed desktop releases

The source and downloadable packages live in [MobileShopERP](https://github.com/saadkhan2003/MobileShopERP). A version tag such as `v0.3.0` triggers [the release workflow](../.github/workflows/publish-desktop-release.yml). It tests the source, builds on Linux, Windows, and macOS runners, signs each updater payload with the Tauri update key, collects the files, and publishes them to a GitHub Release in **this repository**. The release includes `latest.json` at a stable URL:

`https://github.com/saadkhan2003/MobileShopERP/releases/latest/download/latest.json`

The signing private key is stored as the repository Actions secret `MOBILE_SHOP_UPDATE_PRIVATE_KEY`; the matching public key is `MOBILE_SHOP_UPDATE_PUBLIC_KEY`. Both were set from `/home/saad/.config/mobile-shop-erp/update.key` and `.pub` on the developer machine. Keep a secure offline copy of the private key. Do not commit it. Losing it prevents existing installations from verifying future updates. These are **updater signatures**; Windows Authenticode and Apple Developer ID signing/notarization require separate certificates before broad distribution.

## Package routing

The [manifest script](../scripts/create-update-manifest.mjs) requires all six signed updater targets before publishing. Tauri identifies the installed bundle and selects the matching key automatically:

| Installed package | Manifest target | Signed updater payload |
| --- | --- | --- |
| Linux AppImage | `linux-x86_64-appimage` | `.AppImage` |
| Linux Debian package | `linux-x86_64-deb` | `.deb` (system authentication may be required) |
| Windows NSIS setup | `windows-x86_64-nsis` | `.exe` |
| Windows MSI | `windows-x86_64-msi` | `.msi` |
| macOS Apple Silicon DMG/app | `darwin-aarch64-app` | `.app.tar.gz` |
| macOS Intel DMG/app | `darwin-x86_64-app` | `.app.tar.gz` |

The release also carries the two `.dmg` installers. DMG files are for initial installation; Tauri updates the installed macOS application from the signed `.app.tar.gz`. On Linux, a `.deb` installation uses `dpkg` through Tauri's updater and can prompt for administrator authentication.

## Publish the next version

1. Change the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` (and their lockfiles). Commit and push the source.
2. Confirm the normal desktop build workflow passes.
3. Push the matching tag, for example `git tag v0.3.0` then `git push origin v0.3.0`.
4. Wait for **Publish signed desktop release** to finish, then check its release assets and `latest.json`.
5. Install an older package of each supported type on its operating system and verify **Global settings → Check for updates → Install signed update**. The prior 0.2.0-to-0.2.1 AppImage update was tested end to end; the other operating systems need installation checks on those systems.

The workflow refuses to publish if any package or updater signature is missing. A normal development build has no update feed; only the signed release build embeds the public key and this repository's feed URL. The separate `mobile-shop-erp-releases` repository is retained only to serve an updated manifest to installations of versions 0.2.0 and 0.2.1 that were built with its old feed URL.

Implementation uses the [Tauri updater format and installer-specific platform keys](https://v2.tauri.app/plugin/updater/).
