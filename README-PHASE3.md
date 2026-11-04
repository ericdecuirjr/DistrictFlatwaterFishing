# District Flatwater Fishing — Phase 3 preview

This upgrade adds analytics, geotagged fishing maps, responsive mobile styling, and a GitHub Actions Android APK workflow.

## Data safety first

1. Open your current fishing PWA and choose **Settings → Export catch backup (JSON)**. Confirm the file downloaded successfully, and keep an extra copy.
2. Do not clear Chrome site data, uninstall the PWA, or change the Pages URL.
3. The browser app keeps the existing IndexedDB database name `district-flatwater-catches-v1` and existing catch schema.
4. The Android APK has its own app storage. After installation, import the saved catch JSON via **Settings → Import catch backup** and check both catch data and photos before retiring the PWA.

## Preview on the web

Merge this branch after reviewing. GitHub Pages currently deploys from `main`, so until merge the live site is unchanged. Refresh the site after Pages deployment. You should see **Analytics** and **Map** in navigation. Analytics uses saved catches. The Map list works offline, and the interactive map loads only when tapped and online.

## Android workflow

GitHub → Actions → **Build District Flatwater Fishing APK** → **Run workflow**. Select the desired branch and run. Download the debug APK artifact for initial testing. No debug APK is suitable as a long-term release signed by your own key.

To enable the signed release artifact, configure these repository-specific Actions secrets:

- `APK_KEYSTORE_BASE64`
- `APK_STORE_PASSWORD`
- `APK_KEY_ALIAS`
- `APK_KEY_PASSWORD`

Do not paste keys into chat, app JavaScript, or GitHub files. Keep a secure backup of the release keystore. The fishing APK package ID is `com.districtflatwater.fishing`; it is separate from District Flatwater Fitness. For updates, retain the package ID and keystore.

The workflow generates an Android project at build time using Capacitor and packages the local website assets. It uses your existing Cloudflare Worker URL for Gemini identification; no Gemini key is bundled in the APK. The service URL is stored per-installation, so set it again in APK Settings if needed.

## Limitations

Android compatibility, location permissions, file import/export and the actual GitHub Actions build must be tested on your Galaxy. The APK workflow is committed but does not represent an already-built or signed APK. The Leaflet map depends on online map tiles and does not provide offline navigation. Analytics are descriptive, not evidence of causal fish behavior.
