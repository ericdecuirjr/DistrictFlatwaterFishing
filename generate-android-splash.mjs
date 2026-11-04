/* Configure the native Capacitor Android launch theme with the same hunter-green
 * and white fishing emblem as the launcher/header. Generated Android project only:
 * does not touch IndexedDB or application identity.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';

const root='android/app/src/main/res';
const drawable=join(root,'drawable-nodpi');
mkdirSync(drawable,{recursive:true});
const logo=readFileSync('branding-logo.svg');
const graphic=await sharp(logo,{density:300}).resize(360,360).png().toBuffer();
const canvas=await sharp({create:{width:640,height:640,channels:4,background:'#00380e00'}})
  .composite([{input:graphic,left:140,top:140}]).png().toBuffer();
writeFileSync(join(drawable,'df_fishing_splash.png'),canvas);

const stylePath=join(root,'values','styles.xml');
let styles=readFileSync(stylePath,'utf8');
if(!styles.includes('name="AppTheme.NoActionBarLaunch"'))throw Error('Capacitor Android splash theme not found.');
const splashStyle=/<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/;
if(!splashStyle.test(styles))throw Error('Cannot find existing splash style block.');
const revised=[
  '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">',
  '        <item name="windowSplashScreenBackground">#00380e</item>',
  '        <item name="windowSplashScreenAnimatedIcon">@drawable/df_fishing_splash</item>',
  '        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
  '        <item name="android:windowLightStatusBar">false</item>',
  '    </style>'
].join('\n');
styles=styles.replace(splashStyle,revised);
writeFileSync(stylePath,styles);
console.log('Native fishing splash themed: deep green background, white branded emblem.');
