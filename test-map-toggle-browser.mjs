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

 await evaluate(`new Promise(resolve=>{const r=indexedDB.open('district-flatwater-catches-v1');r.onsuccess=()=>{const d=r.result,t=d.transaction('spots','readwrite');for(const [id,status,latitude] of [['green','fished',39],['yellow','want',40]])t.objectStore('spots').put({id,status,latitude,longitude:-77,name:id,waterbody:'Lake',access:'',launch:''});t.oncomplete=()=>{d.close();resolve()}}})`);
 await evaluate(`new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/leaflet.js';s.onload=resolve;s.onerror=reject;document.head.append(s)})`);
 await evaluate(`new Promise(resolve=>{const s=document.createElement('link');s.rel='stylesheet';s.href='./vendor/leaflet.css';s.onload=resolve;document.head.append(s)})`);
 await click('#tab-map');await click('#df-mode-spots');
 await wait("document.querySelectorAll('.df-map-pin').length===2");
 assert(await evaluate("getComputedStyle(document.querySelector('.df-pin-fished')).backgroundColor==='rgb(21, 128, 61)'"),'Fished is green');
 assert(await evaluate("getComputedStyle(document.querySelector('.df-pin-want')).backgroundColor==='rgb(250, 204, 21)'"),'Want is yellow');
 assert(await evaluate("document.querySelector('#df-map-filters').hidden"),'Catch filters hidden');
 assert(await evaluate("document.documentElement.scrollWidth<=390"),'No mobile horizontal overflow');
 await click('#df-mode-catches');await wait("document.querySelectorAll('.df-map-pin').length===0");
 await click('#df-mode-spots');await wait("document.querySelectorAll('.df-map-pin').length===2");
 assert(!errors.length,errors.join('; '));console.log('Mobile map toggle, real Leaflet pins, green/yellow computed colors, empty catch map and layout passed');
}finally{clearTimeout(timer);ws?.close();chrome?.kill();server.close();}
