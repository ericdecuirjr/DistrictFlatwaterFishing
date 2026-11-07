import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const ext=path==='/'?'html':path.split('.').pop();res.setHeader('Content-Type',({js:'text/javascript',mjs:'text/javascript',html:'text/html',css:'text/css',svg:'image/svg+xml',png:'image/png'})[ext]||'application/octet-stream');res.end(await readFile('www'+(path==='/'?'/index.html':path)));}catch{res.writeHead(404);res.end();}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const timer=setTimeout(()=>{console.error('Mobile browser check exceeded 90 seconds');process.exit(1);},90000);timer.unref();
let chrome,ws;
try {
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const executable=['google-chrome','chromium','chromium-browser'].find(x=>spawnSync('which',[x]).status===0);
 if(!executable)throw Error('Chrome is required for the mobile browser check');
 chrome=spawn(executable,['--headless','--no-process-singleton','--disable-gpu','--disable-background-networking','--disable-extensions','--no-proxy-server','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=9222','--user-data-dir='+await mkdtemp(join(tmpdir(),'df-test-')),'about:blank'],{stdio:['ignore','ignore','pipe']});
 let chromeErrors='';chrome.stderr.on('data',chunk=>{chromeErrors+=chunk.toString();});
 let targets;for(let i=0;i<350;i++){try{targets=await (await fetch('http://127.0.0.1:9222/json/list')).json();targets=targets.filter(t=>t.type==='page'&&!t.url.startsWith('chrome-extension:'));if(targets.length)break;}catch{}await sleep(100);}
 if(!targets?.length)throw Error('Chrome did not start: '+chromeErrors.slice(-6000));
 ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description||''));};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression)=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Timed out: '+expression+'; state='+JSON.stringify(await evaluate('({boot:window.__DF_CATCH_APP_BOOT,url:location.href,ready:document.readyState,title:document.title,text:document.body?.innerText?.slice(-1000)})'))+'; errors='+errors.join('; ')+'; chrome='+chromeErrors.slice(-3000));};
 const click=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});};
 const fill=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 console.log('Navigation:',await send('Page.navigate',{url:'http://127.0.0.1:8765'}));await wait('window.__DF_CATCH_APP_BOOT?.initialized');await wait("!document.querySelector('#df-launch-splash')");console.log('Packaged app initialized');

 const assert=(v,m)=>{if(!v)throw Error(m);};
 // Seed an older database before upgrade, then reload the app.
 await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('district-flatwater-catches-v1');r.onsuccess=()=>{const d=r.result,tx=d.transaction('catches','readwrite');tx.objectStore('catches').put({id:'legacy',species:'Bluegill',capturedAt:new Date().toISOString(),photo:new Blob(['old'],{type:'image/png'}),notes:'preserve me'});tx.oncomplete=()=>{d.close();resolve()};tx.onerror=reject;};})`);
 await click('#tab-log');await fill('#trip-name','Sleeter Lake morning');await click('#start-trip');await wait("document.querySelector('#trip-status').textContent.includes('Sleeter')");
 const photo=async()=>{await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=400;c.height=200;const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'catch.png',{type:'image/png'}));const e=document.querySelector('#upload-input');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait("!document.querySelector('#measure-photo').disabled");};
 await photo();await fill('#species','Largemouth bass');await fill('#lure','Worm');await fill('#technique','Texas rig');
 await fill('#gps-latitude','39.1');await fill('#gps-longitude','-77.7');await click('#save-another');
 await wait("document.querySelector('#trip-history').textContent.includes('1 catches')");
 assert(await evaluate("!document.querySelector('#screen-log').hidden&&document.querySelector('#species').value===''&&document.querySelector('#lure').value==='Worm'&&document.querySelector('#technique').value==='Texas rig'"),'Quick log reset/tackle');
 assert(await evaluate("document.querySelector('#gps-latitude').value===''") ,'GPS must not carry silently');
 await click('#use-trip-context');assert(await evaluate("document.querySelector('#gps-latitude').value==='39.1'"),'Explicit trip GPS');
 await photo();await fill('#species','Smallmouth bass');await click('#save-another');await wait("document.querySelector('#trip-history').textContent.includes('2 catches')");
 await send('Page.reload');await wait('window.__DF_CATCH_APP_BOOT?.initialized');await click('#tab-log');
 assert(await evaluate("document.querySelector('#trip-status').textContent.includes('Sleeter')"),'Trip survives reload');
 await click('#end-trip');await wait("document.querySelector('#trip-status').textContent.includes('No active')");
 const records=await evaluate(`new Promise(resolve=>{const r=indexedDB.open('district-flatwater-catches-v1');r.onsuccess=()=>{const d=r.result,q=d.transaction('catches').objectStore('catches').getAll();q.onsuccess=()=>{resolve(q.result.map(({photo,...c})=>c));d.close()}}})`);
 assert(records.length===3&&records.find(c=>c.id==='legacy').notes==='preserve me','Legacy data preserved');
 assert(records.filter(c=>c.tripId).length===2,'Both catches linked');assert(records.find(c=>c.species==='Smallmouth bass').locationSource==='trip','Shared location provenance');
 await wait("!document.querySelector('#df-launch-splash')");await writeFile('/tmp/trip-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert(!errors.length,errors.join('; '));console.log('Trips, quick entry, legacy preservation, tackle, shared GPS and reload checks passed');
}finally{clearTimeout(timer);ws?.close();chrome?.kill();server.close();}
