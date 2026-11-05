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
 chrome=spawn(executable,['--headless','--disable-gpu','--disable-background-networking','--disable-extensions','--no-proxy-server','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=9222','--user-data-dir='+await mkdtemp(join(tmpdir(),'df-test-')),'about:blank'],{stdio:['ignore','ignore','pipe']});
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
 await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=500;c.getContext('2d').fillRect(0,0,1000,500);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'measurement.png',{type:'image/png'}));const e=document.querySelector('#upload-input');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait("!document.querySelector('#measure-photo').disabled");await click('#measure-photo');await wait("!!document.querySelector('[data-role=overlay]')");await fill('[data-role=dimension]','4');
 await evaluate("document.querySelector('[data-role=overlay]').scrollIntoView({block:'center'})");await sleep(200);
 for(const [x,y] of [[.1,.2],[.3,.2],[.1,.6],[.9,.6]]){const p=await evaluate(`(()=>{const r=document.querySelector('[data-role=overlay]').getBoundingClientRect();return {x:r.x+r.width*${x},y:r.y+r.height*${y}};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});console.log('Endpoint',x,y,p,await evaluate("({rect:(()=>{const r=document.querySelector('[data-role=overlay]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})(),circles:[...document.querySelectorAll('[data-role=overlay] circle')].map(c=>[c.getAttribute('cx'),c.getAttribute('cy')]),status:document.querySelector('[data-role=status]').textContent})"));}
 await wait("document.querySelector('[data-role=status]').textContent.includes('16.0 in')");await click('[data-role=apply]');await wait("document.querySelector('#length').value==='16'");console.log('Photo reference produced 16-inch estimate');
 await fill('#species','Test bass');await click('#save-btn');await wait("document.querySelector('.catch-card')?.textContent.includes('~16 in')");
 await send('Page.reload');await sleep(200);await wait('window.__DF_CATCH_APP_BOOT?.initialized');await wait("!document.querySelector('#df-launch-splash')");await click('[data-tab=gallery]');await wait("!!document.querySelector('.catch-card')");
 await evaluate("[...document.querySelectorAll('.catch-card button')].find(e=>e.textContent==='Edit').click()");await wait("document.querySelector('#length').value==='16'");await click('#measure-photo');await wait("document.querySelector('[data-role=status]')?.textContent.includes('16.0 in')");
 if(await evaluate("document.querySelector('[data-role=dimension]').value")!=='4')throw Error('Reference dimension not restored');
 await fill('[data-role=zoom]','200');await click('[data-role=pan]');await writeFile('measure-mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));await click('[data-role=cancel]');
 await fill('#length','17');await click('#save-btn');await wait("document.querySelector('.catch-card')?.textContent.includes('17 in')");if(await evaluate("document.querySelector('.catch-card').textContent.includes('~17')"))throw Error('Manual edit retained estimated label');
 if(errors.length)throw Error(errors.join('; '));console.log('Mobile upload, endpoints, save, reload, restored measurement, zoom, pan, cancel and manual override passed');
} finally {clearTimeout(timer);ws?.close();chrome?.kill('SIGKILL');server.closeAllConnections();server.close();}
