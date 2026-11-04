/* APK-only self-check. Does not read, modify or delete fishing catch records. */
(()=>{
  'use strict';
  const findings=[];
  const timestamp=new Date().toISOString();
  function textResult(ok,label,detail=''){
    findings.push((ok?'PASS':'FAIL')+' — '+label+(detail?' — '+String(detail).slice(0,180):''));
  }
  function summarizeError(err){return String(err?.message||err?.code||err||'unknown error').replace(/https?:\/\/\S+/g,'[URL]').slice(0,180);}
  const errors=[];
  window.addEventListener('error',e=>{errors.push(summarizeError(e.message));});
  window.addEventListener('unhandledrejection',e=>{errors.push(summarizeError(e.reason));});
  const getId=id=>document.getElementById(id);
  async function probeDb(){
    // Use a unique diagnostic database, never the real fishing database.
    const name='__df_apk_probe_temp_v1';
    let connection;
    try{
      connection=await new Promise((resolve,reject)=>{
        const req=indexedDB.open(name,1);
        req.onupgradeneeded=()=>req.result.createObjectStore('test');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error||Error('IndexedDB open error'));
        req.onblocked=()=>reject(Error('IndexedDB is blocked'));
      });
      await new Promise((resolve,reject)=>{
        const tx=connection.transaction('test','readwrite');
        tx.objectStore('test').put({note:'temporary native storage probe',photo:new Blob(['test'],{type:'image/jpeg'})},'probe');
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error||Error('IndexedDB write failed'));
        tx.onabort=()=>reject(tx.error||Error('IndexedDB transaction aborted'));
      });
      const row=await new Promise((resolve,reject)=>{
        const req=connection.transaction('test','readonly').objectStore('test').get('probe');
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error||Error('IndexedDB read failed'));
      });
      if(row?.note==='temporary native storage probe'&&row?.photo?.size===4){
        textResult(true,'Temporary IndexedDB photo write/read');
      }else{
        textResult(false,'Temporary IndexedDB photo write/read','unexpected data');
      }
    }catch(e){textResult(false,'Temporary IndexedDB photo write/read',summarizeError(e));}
    finally{
      try{connection?.close();const del=indexedDB.deleteDatabase(name);del.onerror=()=>{};}catch(_){}
    }
  }
  async function probeNetwork(){
    if(!navigator.onLine){textResult(false,'Internet access','Phone reports offline');return;}
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),9000);
    try{
      const resp=await fetch('https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m',{signal:ctrl.signal,cache:'no-store'});
      textResult(resp.ok,'Open-Meteo network response','HTTP '+resp.status);
    }catch(e){textResult(false,'Open-Meteo network response',summarizeError(e));}
    finally{clearTimeout(timeout);}
  }
  async function diagnose(){
    findings.length=0;
    const run=getId('df-apk-run'),out=getId('df-apk-result');
    run.disabled=true;run.textContent='Running checks...';out.textContent='Checking Android connection, image APIs, and temporary storage.';
    try{
      textResult(true,'APK diagnostics loaded','build 1');
      textResult(!!window.Capacitor,'Capacitor runtime',window.Capacitor?.getPlatform?.()||'not detected');
      const native=window.DistrictFlatwaterNative;
      textResult(!!native?.isNative,'Native photo/GPS bridge',native?.isNative?'ready':'not loaded');
      textResult(!!window.Capacitor?.isPluginAvailable?.('Camera'),'Native Camera plugin');
      textResult(!!window.Capacitor?.isPluginAvailable?.('Geolocation'),'Native Geolocation plugin');
      textResult(typeof indexedDB!=='undefined','IndexedDB API');
      textResult(typeof Blob!=='undefined'&&typeof File!=='undefined','Photo file APIs');
      textResult(!!getId('photo-preview'),'Catch log user interface');
      const boot=window.__DF_CATCH_APP_BOOT;
      textResult(!!boot?.initialized,'Catch app initialized',boot?.storageError||('main app version '+(boot?.version||'unknown')));
      if(boot?.databaseVersion)textResult(true,'Catch database opened','schema version '+boot.databaseVersion+(boot.databaseRepair?' · missing store repaired':''));
      if(boot?.storageWarning)textResult(false,'Catch database upgrade blocked',boot.storageWarning);
      textResult(typeof getId('version')?.textContent==='string','Main app version',getId('version')?.textContent||'not shown');
      if(typeof indexedDB!=='undefined')await probeDb();
      await probeNetwork();
      if(errors.length)textResult(false,'Browser JavaScript errors',errors.slice(-3).join(' | '));
      else textResult(true,'Browser JavaScript errors','none observed this session');
    }catch(e){textResult(false,'Diagnostics script',summarizeError(e));}
    const report='District Flatwater Fishing APK diagnostic\n'+timestamp+'\n'+findings.join('\n');
    out.textContent=report;
    run.disabled=false;run.textContent='Run checks again';
    getId('df-apk-copy').disabled=false;
    getId('df-apk-copy').onclick=()=>{navigator.clipboard?.writeText(report).then(()=>{getId('df-apk-copy').textContent='Copied report';}).catch(()=>{getId('df-apk-copy').textContent='Select report text to copy';});};
  }
  function insert(){
    const banner=document.createElement('section');
    banner.id='df-apk-diagnostic-panel';
    banner.setAttribute('aria-label','Android APK diagnostic checks');
    banner.style.cssText='margin:12px auto 4px;padding:14px;max-width:960px;border:2px solid #c7a350;border-radius:14px;background:#fff8e6;color:#24402e;font:14px system-ui, sans-serif;';
    const title=document.createElement('strong');
    title.textContent='Android APK Diagnostics';
    const explanation=document.createElement('p');
    explanation.textContent='If camera, catch saving, or GPS fails, run these checks. They do not access your actual catch records or location. Open-Meteo is tested using a fixed test coordinate, not your GPS.';
    explanation.style.cssText='margin:8px 0;line-height:1.4';
    const controls=document.createElement('div');
    controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    const run=document.createElement('button');
    run.id='df-apk-run';run.type='button';run.textContent='Run safe diagnostic checks';
    const copy=document.createElement('button');
    copy.id='df-apk-copy';copy.type='button';copy.textContent='Copy report';copy.disabled=true;
    for(const b of [run,copy])b.style.cssText='padding:10px 12px;border:1px solid #a8904b;border-radius:9px;background:white;color:#24402e;min-height:44px;font-weight:600';
    const out=document.createElement('pre');
    out.id='df-apk-result';
    out.style.cssText='white-space:pre-wrap;word-break:break-word;max-width:100%;overflow:auto;font:12px ui-monospace,monospace;';
    out.textContent='No tests run yet. Your catches are not accessed by this diagnostic.';
    run.addEventListener('click',diagnose);
    controls.append(run,copy);banner.append(title,explanation,controls,out);
    document.body.prepend(banner);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',insert);
  else insert();
})();
