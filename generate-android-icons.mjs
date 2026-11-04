/* Generate Android launcher assets from the same checked-in brand artwork used by the in-app banner.
   Runs in GitHub Actions after npx cap add android. Does not modify user storage. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';

const root='android/app/src/main/res';
const svg=readFileSync('branding-logo.svg','utf8');
if(!svg.includes('District Flatwater Fishing'))throw Error('Expected fishing brand SVG not found.');
const full=Buffer.from(svg);
const noBackground=svg.replace(/<rect\s+width="384"\s+height="384"\s+fill="#00380e"\s*\/>/, '');
if(noBackground===svg)throw Error('Could not isolate logo for adaptive foreground');
const foreground=Buffer.from(noBackground);
const densities={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
const adaptive={mdpi:108,hdpi:162,xhdpi:216,xxhdpi:324,xxxhdpi:432};
for(const [density,size] of Object.entries(densities)){
  const dir=join(root,'mipmap-'+density);
  mkdirSync(dir,{recursive:true});
  const png=await sharp(full,{density:300}).resize(size,size).png().toBuffer();
  writeFileSync(join(dir,'ic_launcher.png'),png);
  writeFileSync(join(dir,'ic_launcher_round.png'),png);
}
for(const [density,size] of Object.entries(adaptive)){
  const dir=join(root,'mipmap-'+density);
  const logoSize=Math.round(size*.67);
  const png=await sharp(foreground,{density:300}).resize(logoSize,logoSize).png().toBuffer();
  const centered=await sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:png,top:Math.floor((size-logoSize)/2),left:Math.floor((size-logoSize)/2)}]).png().toBuffer();
  writeFileSync(join(dir,'ic_launcher_foreground.png'),centered);
}
const adaptiveDir=join(root,'mipmap-anydpi-v26');
mkdirSync(adaptiveDir,{recursive:true});
const xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@drawable/df_brand_icon_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
writeFileSync(join(adaptiveDir,'ic_launcher.xml'),xml);
writeFileSync(join(adaptiveDir,'ic_launcher_round.xml'),xml);
const drawable=join(root,'drawable');
mkdirSync(drawable,{recursive:true});
writeFileSync(join(drawable,'df_brand_icon_background.xml'),'<?xml version="1.0" encoding="utf-8"?>\\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#00380e"/></shape>\\n');
console.log('Generated branded Android launcher assets from branding-logo.svg');
