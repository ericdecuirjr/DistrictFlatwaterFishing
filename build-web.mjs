import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
const out='www';mkdirSync(out,{recursive:true});
for(const file of ['index.html','app.js','styles.css','phase3.js','phase3.css','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png']){
 if(!existsSync(file))throw Error('Missing '+file);
 cpSync(file,out+'/'+file);
}
let html=readFileSync(out+'/index.html','utf8');
if(!html.includes('phase3.css'))html=html.replace('</head>','<link rel="stylesheet" href="./phase3.css" />\n</head>');
if(!html.includes('phase3.js'))html=html.replace('</body>','<script src="./phase3.js" defer></script>\n</body>');
if(!html.includes('native-bridge.js'))html=html.replace('</head>','<script src="./native-bridge.js" defer></script>\n</head>');
writeFileSync(out+'/index.html',html);
await build({entryPoints:['native-bridge.mjs'],bundle:true,platform:'browser',format:'iife',target:'es2020',outfile:out+'/native-bridge.js'});
console.log('Capacitor web files created');
