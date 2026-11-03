# District Flatwater Fishing — Phase 1

A separate, offline-first catch log for Android Chrome / PWA. **This does not modify Workout-Tracker.**

## Included features

- Take a catch photograph or pick one from the phone; automatically compress/store it locally.
- Capture GPS coordinates when selecting a new photograph, **with permission**; date/time defaults to the moment the photograph is selected.
- Use Open-Meteo model data for nearby temperature, *surface* barometric pressure, current conditions and today's forecast when online. Numbers are model estimates, not a phone sensor reading. Historical weather for older photos is not automatic.
- Enter fish species manually, or ask Gemini to suggest one after a one-time secure server setup; review suggestions before saving.
- Optional length, weight, lure, notes; gallery with species filter/date/species sorting and edit/view/delete.
- Local photos and details stored in IndexedDB; export/import complete JSON backups including photo data.
- Installable PWA and offline cached app shell. GPS/weather/AI need their respective device/network availability.

## Get it running using only your Galaxy

1. Use the existing public GitHub repository `ericdecuirjr/DistrictFlatwaterFishing`, separate from `Workout-Tracker`.
2. On your Galaxy, unzip the download in Samsung **My Files**. Open the GitHub repository in Chrome (use **Desktop site** if GitHub hides the upload action). Tap **Add file → Upload files** and upload the files **inside** the extracted directory (not the ZIP itself and not the outer directory). The **root** of `main` must contain `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, and `README.md` (plus optional `.gitignore`). Also create or upload the `assets/` folder with `icon.svg`, `icon-192.png` and `icon-512.png`, and `gemini-worker/` for the optional AI backend. If the mobile picker cannot upload folders, upload the root files first, then use GitHub to create the `assets` and `gemini-worker` folders and upload their individual files within each folder. The Gemini Worker source is safe to commit; never upload API keys or other secrets.
3. In GitHub repository **Settings → Pages**, under **Build and deployment**, choose **Deploy from a branch**, `main`, and `/(root)`; save. Your app URL should be `https://ericdecuirjr.github.io/DistrictFlatwaterFishing/` once Pages finishes deploying.
4. Open the live URL in Android Chrome, grant location permission (optional), and test a manually identified catch. Use Chrome's menu → **Add to Home screen / Install app**.
5. **Export a backup** through Settings before switching browsers, uninstalling, clearing website data, or moving to an APK. Browser/PWA/Android-app storage may be separate; install/upgrade is not an automatic data migration.

## Enable Gemini identification (one-time setup)

The public app must never contain a Gemini API key. A Cloudflare Worker acts as a proxy with the key stored as a server-side secret. This optional feature is **not live** until configured and deployed. Google Gemini requests may incur charges.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Create a Cloudflare account and a Worker named `district-flatwater-gemini` using the code in `gemini-worker/index.js`. The `gemini-worker/wrangler.toml` file is for the Wrangler CLI option, not for pasting into the dashboard.
3. Under the Worker's **Settings → Variables and Secrets**, add **GEMINI_API_KEY** as a **Secret**, paste your key, and deploy. Never put the key in GitHub or the app settings.
4. Set **ALLOWED_ORIGIN** (plain text variable) to `https://ericdecuirjr.github.io` and deploy. If hosted elsewhere, replace this with that exact origin, excluding the `/DistrictFlatwaterFishing` path. Multiple comma-separated origins are supported.
5. Deploy Worker and copy its public HTTPS URL (e.g. `https://district-flatwater-gemini.YOUR-ACCOUNT.workers.dev`). In the app's **Settings → Gemini service URL**, paste the Worker URL, save, and tap **Identify with Gemini** on a photo.

**Security caveat:** Restricting CORS to your Pages origin is **not sufficient authentication**, and a public Worker URL can still be called outside a browser. Add Cloudflare rate limits / WAF / Access and account/budget limits before sharing the service broadly. For initial personal testing, monitor Gemini API usage and do not expose private secrets. We do not include a shared API key.

### CLI deployment alternative

From the `gemini-worker` folder on a machine with Node:

```bash
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Ensure `ALLOWED_ORIGIN` in `wrangler.toml` is your actual hosting origin and the Worker is deployed. To keep this workflow Galaxy-only, the Cloudflare dashboard can be used instead.

## Testing checklist

- [ ] Select a photo; preview loads and location permission is requested.
- [ ] If location is allowed, GPS displays; with internet, weather and pressure fill automatically.
- [ ] Enter a species manually and save. Refresh the app; the catch persists.
- [ ] Open Gallery; sort by date/species and filter by species.
- [ ] Edit and save a catch; view details and optional Google Maps location link.
- [ ] Export JSON; import it into a clean app install/browser and verify photo + details.
- [ ] Disconnect internet and manually log a catch; it persists offline after first online PWA load.
- [ ] Once the Gemini Worker is deployed, identify a clear fish photograph and verify review is still required.

## Privacy, storage and limitations

- Catch photos and GPS coordinates stay inside the device's origin-specific IndexedDB until you explicitly export, clear site data, or tap the Gemini button (the compressed photo is then sent to Google via the Worker).
- Open-Meteo receives the coordinates when retrieving weather. A map link to Google Maps is only opened if clicked.
- Local browser storage is not synchronized across devices and can be evicted by the browser/system. Make regular backups.
- Image compression strips original EXIF metadata; the app records upload/selection time and current GPS instead of reading historic EXIF.
- Today's forecast is the available forecast at logging time, not a later re-creation of the forecast.
- No APK is in this Phase 1 bundle. After testing, this same app can be packaged as a signed Android APK (with an explicit backup/import migration step).
- AI fish identification can be wrong, especially with similar species. It should not be used as an authoritative legal fishing-regulations reference.

## Files

`index.html` / `styles.css`: mobile UI; `app.js`: IndexedDB and catch logging; `sw.js` / `manifest.webmanifest`: install + offline shell; `assets`: app icons; `gemini-worker`: optional secure identification backend.
