# Signed desktop updates

Tauri verifies every updater bundle with a public key embedded at build time. The corresponding private key must stay outside the repository. The current developer machine has a signing key at `/home/saad/.config/mobile-shop-erp/update.key` and its public key at `/home/saad/.config/mobile-shop-erp/update.key.pub`; keep a secure copy of the private key before distributing any signed release. If it is lost, existing installations cannot verify future updates from a replacement key.

The release host is the public [Mobile Shop ERP releases repository](https://github.com/saadkhan2003/mobile-shop-erp-releases). Its `latest.json` asset is available at a stable HTTPS URL. Build from this source checkout with:

```bash
export MOBILE_SHOP_UPDATE_URL='https://github.com/saadkhan2003/mobile-shop-erp-releases/releases/latest/download/latest.json'
export TAURI_SIGNING_PRIVATE_KEY_PATH='/home/saad/.config/mobile-shop-erp/update.key'
export MOBILE_SHOP_UPDATE_PUBLIC_KEY_PATH='/home/saad/.config/mobile-shop-erp/update.key.pub'
npm run release:signed
export MOBILE_SHOP_RELEASE_BASE_URL='https://github.com/saadkhan2003/mobile-shop-erp-releases/releases/download/v0.2.1'
export MOBILE_SHOP_RELEASE_ASSET_NAME='Mobile.Shop.ERP_0.2.1_amd64.AppImage'
npm run release:manifest
```

Upload `release/latest.json`, the generated `.AppImage`, its `.sig` file, and the `.deb` to a GitHub release tagged with the version, for example `v0.2.1`. GitHub renames spaces in the uploaded asset filenames to dots, so `MOBILE_SHOP_RELEASE_ASSET_NAME` must match the resulting AppImage asset name. The release URL used for the manifest must match that tag. Install the signed AppImage on a test computer, use **Global settings → Check for updates**, then publish a newer version and confirm that its signature is accepted before giving the installer to shops. The Linux `.deb` is for manual installation; Tauri's Linux updater uses the AppImage bundle. Increment the version in both `package.json` and `src-tauri/tauri.conf.json` before each release.

For this Linux release, publish with:

```bash
gh release create v0.2.1 --repo saadkhan2003/mobile-shop-erp-releases --title 'Mobile Shop ERP 0.2.1' --notes-file release/notes-v0.2.1.md \
  release/latest.json \
  'src-tauri/target/release/bundle/appimage/Mobile Shop ERP_0.2.1_amd64.AppImage' \
  'src-tauri/target/release/bundle/appimage/Mobile Shop ERP_0.2.1_amd64.AppImage.sig' \
  'src-tauri/target/release/bundle/deb/Mobile Shop ERP_0.2.1_amd64.deb' \
  'src-tauri/target/release/bundle/deb/Mobile Shop ERP_0.2.1_amd64.deb.sig'
```

The ordinary development build has no update feed and reports that state in Global settings. The signed release script refuses to run without an HTTPS endpoint and both key paths. Never commit or upload the private signing key.

Implementation follows the [Tauri updater documentation](https://v2.tauri.app/plugin/updater/). Keep previous signed release assets available so installed copies can still retrieve their update paths.
