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
 await click('#tab-log');
 const choose=async broken=>{await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=400;c.height=200;const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();for(let i=0;i<4;i++)dt.items.add(new File([${broken}?i===2?'invalid':blob:blob],'photo-'+i+'.png',{type:'image/png'}));const e=document.querySelector('#batch-input');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait("document.querySelector('#batch-status').textContent.includes('Photo 1 of 4')&&!document.querySelector('#save-btn').disabled");};
 await choose(true);
 await click('#save-btn');assert(await evaluate("!document.querySelector('#batch-panel').hidden&&document.querySelector('#batch-status').textContent.includes('Photo 1')"),'Missing species must not advance');
 await fill('#species','Batch bass');await fill('#lure','Spinner');await fill('#technique','Slow retrieve');await fill('#gps-latitude','39.1');await fill('#gps-longitude','-77.7');
 await evaluate("document.querySelector('#save-btn').click();document.querySelector('#save-btn').click()");
 await wait("document.querySelector('#batch-status').textContent.includes('Photo 2 of 4')&&!document.querySelector('#save-btn').disabled");
 assert(await evaluate("document.querySelector('#species').value===''&&document.querySelector('#gps-latitude').value===''&&document.querySelector('#lure').value==='Spinner'"),'Each catch resets species/GPS and keeps tackle');
 await click('#batch-skip');await wait("document.querySelector('#batch-status').textContent.includes('Photo 4 of 4')&&!document.querySelector('#save-btn').disabled");
 assert(await evaluate("document.querySelector('#batch-status').textContent.includes('1 unreadable')"),'Unreadable file must be counted');
 await fill('#species','Batch trout');await click('#save-btn');await wait("document.querySelector('#batch-panel').hidden&&!document.querySelector('#screen-gallery').hidden");
 const records=async()=>evaluate(`new Promise(resolve=>{const r=indexedDB.open('district-flatwater-catches-v1');r.onsuccess=()=>{const d=r.result,q=d.transaction('catches').objectStore('catches').getAll();q.onsuccess=()=>{resolve(q.result.map(c=>({id:c.id,species:c.species,latitude:c.latitude,photoSize:c.photo.size})));d.close()}}})`);
 let rows=await records();assert(rows.length===2,'Double save/skip/failure must produce exactly two catches');assert(rows.find(c=>c.species==='Batch trout').latitude===null,'GPS must not leak');assert(rows.every(c=>c.photoSize>0),'Saved photos retained');
 await click('#tab-log');await choose(false);await fill('#species','Keep after stopping');await click('#save-btn');await wait("document.querySelector('#batch-status').textContent.includes('Photo 2 of 4')&&!document.querySelector('#save-btn').disabled");
 await evaluate('window.confirm=()=>false');await click('#batch-stop');assert(await evaluate("!document.querySelector('#batch-panel').hidden"),'Cancel stop keeps queue');await evaluate('window.confirm=()=>true');await click('#batch-stop');await wait("document.querySelector('#batch-panel').hidden");
 rows=await records();assert(rows.length===3,'Stopping keeps committed catches only');
 await send('Page.reload');await wait('window.__DF_CATCH_APP_BOOT?.initialized');assert((await records()).length===3,'Saved batch catches survive reopening');
 assert(!errors.length,errors.join('; '));console.log('Batch selection/review, required fields, duplicate save protection, skip, unreadable recovery, GPS isolation, stop/cancel and persistence passed');
}finally{clearTimeout(timer);ws?.close();chrome?.kill();server.close();}
