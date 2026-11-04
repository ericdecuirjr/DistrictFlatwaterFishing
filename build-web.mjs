import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import sharp from 'sharp';
const out='www';mkdirSync(out,{recursive:true});
for(const file of ['index.html','app.js','styles.css','phase3.js','phase3.css','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','android-diagnostics.js','photo-metadata.js','historical-weather.js','branding-logo.svg','gps-coordinates.js','splash.js']){
 if(!existsSync(file))throw Error('Missing '+file);
 cpSync(file,out+'/'+file);
}
// The PWA icon bitmaps are derived from the same SVG used for the app banner.
const emblem=readFileSync('branding-logo.svg');
for(const size of [192,512]){
  await sharp(emblem,{density:300}).resize(size,size).png().toFile(out+'/icon-'+size+'.png');
}
let html=readFileSync(out+'/index.html','utf8');
if(!html.includes('phase3.css'))html=html.replace('</head>','<link rel="stylesheet" href="./phase3.css" />\n</head>');
if(!html.includes('phase3.js'))html=html.replace('</body>','<script src="./phase3.js" defer></script>\n</body>');
if(!html.includes('native-bridge.js'))html=html.replace('</head>','<script src="./native-bridge.js" defer></script>\n</head>');
if(!html.includes('android-diagnostics.js'))html=html.replace('</head>','<script src="./android-diagnostics.js" defer></script>\n</head>');
// APK web assets are packaged locally. Do not use website service-worker caching inside the APK:
// it may serve outdated app.js after installing a newer native build.
let appJs=readFileSync(out+'/app.js','utf8');
appJs=appJs.replace("if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});", "/* Android local asset bundle: service worker disabled to prevent stale JS after APK updates. */");
writeFileSync(out+'/app.js',appJs);
// Unregister older APK-local service workers; leave IndexedDB and all catch records intact.
html=html.replace('</head>','<script>if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(list=>list.forEach(reg=>reg.unregister())).catch(()=>{});}</script>\n</head>');
writeFileSync(out+'/index.html',html);
await build({entryPoints:['native-bridge.mjs'],bundle:true,platform:'browser',format:'iife',target:'es2020',outfile:out+'/native-bridge.js'});
console.log('Capacitor web files created');
