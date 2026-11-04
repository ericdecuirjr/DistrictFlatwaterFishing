/* App globals are scoped to prevent duplicate native/web script declaration crashes. */
(function districtFlatwaterCatchApp(){
'use strict';
if(window.__DF_CATCH_APP_BOOT) return;
window.__DF_CATCH_APP_BOOT={initialized:false,version:'3.7.2'};
/* District Flatwater Fishing — Phase 1. No frameworks or tracking. */
'use strict';
const VERSION = '3.7.2';
const DB_NAME = 'district-flatwater-catches-v1';
const STORE = 'catches';
const nativeBridge = () => window.DistrictFlatwaterNative;
const $ = id => document.getElementById(id);
let db, photoBlob = null, previewUrl = null, editingId = null, draft = emptyDraft();
let galleryUrls = [], toastTimer = null, contextToken = 0, aiPending = false, selectedMetadata = null, photoSelectionToken = 0;
let historicalCandidate = null, historicalRequest = null, historicalGeneration = 0;
function emptyDraft(){return {capturedAt:new Date().toISOString(),latitude:null,longitude:null,accuracy:null,weather:null,aiSuggestion:null,aiConfidence:null,scientificName:null,timeSource:'phone',locationSource:null};}
function notify(msg,error=false){const t=$('toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',error?9500:4300);if(error){console.warn('[District Flatwater]',msg);const diag=$('diagnostic-output');if(diag){diag.hidden=false;diag.textContent=msg;}}}
function nowLocal(iso){const d=new Date(iso);const shift=d.getTimezoneOffset()*60000;return new Date(d.getTime()-shift).toISOString().slice(0,16);}
function localToIso(str){const d=new Date(str);return Number.isNaN(d.getTime())?null:d.toISOString();}
function prettyDate(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?'Unknown date':d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}
function shortDate(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}
/* Open without pinning version 1: prior native builds could create an empty
   IndexedDB database before the catch store existed. A version upgrade adds
   the missing store WITHOUT deleting the database or any other object stores. */
function openDb(){
  return new Promise((resolve,reject)=>{
    const boot=window.__DF_CATCH_APP_BOOT||{};
    function ensureStore(request){
      const database=request.result;
      let store;
      if(!database.objectStoreNames.contains(STORE)){
        store=database.createObjectStore(STORE,{keyPath:'id'});
      }else{
        store=request.transaction.objectStore(STORE);
      }
      if(!store.indexNames.contains('capturedAt'))store.createIndex('capturedAt','capturedAt');
      if(!store.indexNames.contains('species'))store.createIndex('species','species');
    }
    function finish(request,wasRepair){
      const database=request.result;
      if(!database.objectStoreNames.contains(STORE)){
        database.close();
        reject(Error('Catch storage setup did not create the catches store.'));
        return;
      }
      database.onversionchange=()=>database.close();
      boot.databaseVersion=database.version;
      if(wasRepair)boot.databaseRepair='Created missing catches store without clearing other storage.';
      resolve(database);
    }
    const request=indexedDB.open(DB_NAME);
    request.onupgradeneeded=()=>ensureStore(request);
    request.onerror=()=>reject(request.error||Error('Cannot open catch database.'));
    request.onsuccess=()=>{
      const database=request.result;
      if(database.objectStoreNames.contains(STORE)){
        finish(request,false);
        return;
      }
      const nextVersion=database.version+1;
      database.close();
      const repair=indexedDB.open(DB_NAME,nextVersion);
      repair.onupgradeneeded=()=>ensureStore(repair);
      repair.onerror=()=>reject(repair.error||Error('Could not repair missing catch storage.'));
      repair.onblocked=()=>{boot.storageWarning='Close other fishing app windows to finish a safe storage upgrade.';};
      repair.onsuccess=()=>finish(repair,true);
    };
  });
}
function getAll(){return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function getOne(id){return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function putCatch(record){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function removeCatch(id){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function tab(name){
  const requested=$('screen-'+name)?name:'log';
  const navName=['settings','diagnostics'].includes(requested)?'more':requested;
  document.querySelectorAll('main > .screen').forEach(screen=>{screen.hidden=screen.id!=='screen-'+requested;});
  // The branded banner now sits outside main and remains visible on every tab.
  document.querySelectorAll('#app-bottom-nav .bottom-nav-item').forEach(button=>{
    const active=button.dataset.tab===navName;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  if(requested==='gallery')renderGallery();
  if(requested==='log')$('species').focus({preventScroll:true});
  document.dispatchEvent(new CustomEvent('df-tab-change',{detail:{name:requested}}));
  window.scrollTo({top:0,behavior:'smooth'});
}
function showNetwork(){const online=navigator.onLine;$('network-dot').classList.toggle('online',online);$('network-label').textContent=online?'Online':'Offline';}
function updateLocationUI(){const lat=draft.latitude,lon=draft.longitude;$('location-value').textContent=Number.isFinite(lat)&&Number.isFinite(lon)?`${lat.toFixed(5)}, ${lon.toFixed(5)}`:'Not captured';$('weather-btn').disabled=!(Number.isFinite(lat)&&Number.isFinite(lon));const w=draft.weather;$('temperature-value').textContent=w&&Number.isFinite(w.temperatureF)?`${Math.round(w.temperatureF)} °F`:'—';$('pressure-value').textContent=w&&Number.isFinite(w.surfaceHpa)?`${(w.surfaceHpa*.0295299830714).toFixed(2)} inHg`:'—';$('conditions-value').textContent=w?.conditions||'—';$('forecast-value').hidden=!w?.forecast;$('forecast-value').textContent=w?.forecast||'';
  const valid=Number.isFinite(lat)&&Number.isFinite(lon);
  $('gps-latitude').value=valid?String(lat):'';
  $('gps-longitude').value=valid?String(lon):'';
  $('gps-source').textContent=valid?(
    draft.locationSource==='photo-exif'?'Using original photo GPS coordinates.':
    draft.locationSource==='manual'?'Using manually entered coordinates.':
    draft.locationSource==='phone'?'Using current phone GPS coordinates.':
    'Using saved GPS coordinates.'
  ):'No GPS location selected.';
  updateHistoricalControls();}
function updateHistoricalControls(){
  const iso=localToIso($('caught-at').value);
  const service=window.DistrictFlatwaterHistoricalWeather;
  const error=service?service.check(iso,draft.latitude,draft.longitude):'Historical weather service unavailable';
  $('historical-lookup-btn').disabled=!!error||!!historicalRequest;
  if(!historicalCandidate && !historicalRequest)$('historical-status').textContent=error||'Ready to request weather for the selected time and coordinates.';
}
function cancelHistoricalPreview(){
  historicalGeneration++;
  if(historicalRequest){historicalRequest.abort();historicalRequest=null;}
  historicalCandidate=null;
  $('historical-preview').hidden=true;
  $('historical-preview-details').textContent='';
  $('historical-lookup-btn').textContent='◷ Look up historical weather';
  updateHistoricalControls();
}
function describeHistorical(weather){
  const labels=[
    'Matched observation: '+new Date(weather.observedAt).toLocaleString(),
    'Distance from selected time: '+weather.matchedMinutes+' minutes',
    Number.isFinite(weather.temperatureF)?'Temperature: '+Math.round(weather.temperatureF)+' °F':null,
    Number.isFinite(weather.surfaceHpa)?'Surface pressure: '+(weather.surfaceHpa*.0295299830714).toFixed(2)+' inHg':null,
    'Conditions: '+weather.conditions,
    'Source: '+weather.source
  ];
  return labels.filter(Boolean).join('\n');
}
async function lookupHistoricalWeather(){
  const service=window.DistrictFlatwaterHistoricalWeather;
  const iso=localToIso($('caught-at').value);
  const lat=draft.latitude,lon=draft.longitude;
  const err=service?service.check(iso,lat,lon):'Historical weather is unavailable.';
  if(err){notify(err,true);updateHistoricalControls();return;}
  if(!navigator.onLine){notify('Historical weather requires internet. Your catch can be saved without weather.',true);return;}
  cancelHistoricalPreview();
  const generation=++historicalGeneration;
  const controller=new AbortController();
  historicalRequest=controller;
  $('historical-lookup-btn').disabled=true;
  $('historical-lookup-btn').textContent='Loading historical weather...';
  $('historical-status').textContent='Looking up the selected date and GPS coordinates. No changes to your catch yet.';
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{
    const result=await service.lookup(iso,lat,lon,controller.signal);
    if(generation!==historicalGeneration||iso!==localToIso($('caught-at').value)||draft.latitude!==lat||draft.longitude!==lon)return;
    historicalCandidate={weather:result,iso,lat,lon};
    $('historical-preview-details').textContent=describeHistorical(result);
    $('historical-preview').hidden=false;
    $('historical-status').textContent='Historical estimate found. Review it, then choose Use or Discard.';
  }catch(e){
    if(generation===historicalGeneration){
      $('historical-status').textContent='No historical estimate applied. '+(e?.name==='AbortError'?'Request timed out or was cancelled.':e?.message||String(e));
    }
  }finally{
    clearTimeout(timeout);
    if(generation===historicalGeneration){
      historicalRequest=null;
      $('historical-lookup-btn').textContent='◷ Look up historical weather';
      updateHistoricalControls();
    }
  }
}
function applyHistoricalWeather(){
  const candidate=historicalCandidate;
  if(!candidate)return;
  if(candidate.iso!==localToIso($('caught-at').value)||candidate.lat!==draft.latitude||candidate.lon!==draft.longitude){
    cancelHistoricalPreview();notify('The catch date or location changed; look up historical weather again.',true);return;
  }
  draft.weather={...candidate.weather};
  $('historical-status').textContent='Historical weather applied. Save or update the catch to retain it.';
  cancelHistoricalPreview();
  $('historical-status').textContent='Historical weather applied. Save or update the catch to retain it.';
  updateLocationUI();
  notify('Historical weather added to this catch. Review before saving.');
}
function wmoName(code){if(code===0)return'Clear skies';if(code===1)return'Mostly clear';if(code===2)return'Partly cloudy';if(code===3)return'Overcast';if([45,48].includes(code))return'Fog';if([51,53,55,56,57].includes(code))return'Drizzle';if([61,63,65,66,67,80,81,82].includes(code))return'Rain';if([71,73,75,77,85,86].includes(code))return'Snow';if([95,96,99].includes(code))return'Thunderstorms';return'Conditions unavailable';}
async function fetchWeather(token=contextToken){cancelHistoricalPreview();if(!Number.isFinite(draft.latitude)||!Number.isFinite(draft.longitude)){notify('Capture GPS first.',true);return;}if(!navigator.onLine){notify('Saved location. Weather will need internet.',true);return;}
  $('weather-btn').disabled=true;$('weather-btn').textContent='Loading weather...';
  try{const p=new URLSearchParams({latitude:String(draft.latitude),longitude:String(draft.longitude),current:'temperature_2m,pressure_msl,surface_pressure,weather_code',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',temperature_unit:'fahrenheit',timezone:'auto',forecast_days:'2'});
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch('https://api.open-meteo.com/v1/forecast?'+p,{signal:controller.signal});}finally{clearTimeout(timer);}if(!response.ok)throw Error('Weather service unavailable');const j=await response.json();if(token!==contextToken)return;const c=j.current||{},d=j.daily||{};let forecast='';if(Array.isArray(d.weather_code)&&d.weather_code.length){const chance=Number.isFinite(d.precipitation_probability_max?.[0])?` · ${Math.round(d.precipitation_probability_max[0])}% chance of precipitation`:'';const hi=Number.isFinite(d.temperature_2m_max?.[0])?` · High ${Math.round(d.temperature_2m_max[0])}°F`:'';forecast=`Today's forecast: ${wmoName(d.weather_code[0])}${hi}${chance}`;}
    draft.weather={temperatureF:Number.isFinite(c.temperature_2m)?c.temperature_2m:null,surfaceHpa:Number.isFinite(c.surface_pressure)?c.surface_pressure:null,seaLevelHpa:Number.isFinite(c.pressure_msl)?c.pressure_msl:null,weatherCode:c.weather_code??null,conditions:wmoName(c.weather_code),forecast,observedAt:c.time||new Date().toISOString(),source:'Open-Meteo model'};updateLocationUI();notify('Weather recorded.');
  }catch(e){notify(`Could not load weather: ${e.message}`,true);}finally{$('weather-btn').textContent='↻ Refresh weather';updateLocationUI();}}
async function captureLocation(withWeather=false){
  cancelHistoricalPreview();
  if(!nativeBridge()?.getPosition&&!navigator.geolocation){notify('Phone GPS is unavailable on this device.',true);return;}
  const token=++contextToken;
  const button=withWeather?$('location-btn'):$('phone-gps-btn');
  button.disabled=true;
  button.textContent='Finding phone GPS...';
  try{
    const p=nativeBridge()?.getPosition?await nativeBridge().getPosition():await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));
    if(token!==contextToken)return;
    const latitude=p.coords?.latitude,longitude=p.coords?.longitude;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('Phone returned invalid GPS coordinates.');
    draft.latitude=latitude;draft.longitude=longitude;draft.accuracy=p.coords.accuracy;
    draft.weather=null;draft.locationSource='phone';
    updateLocationUI();
    notify(withWeather?'Phone GPS captured; loading current weather.':'Phone GPS captured. Weather was not changed.');
    if(withWeather)await fetchWeather(token);
  }catch(e){
    if(token===contextToken)notify('GPS unavailable: '+(e?.message||'Check Location permission and device settings')+'. You can still enter coordinates manually.',true);
  }finally{
    button.disabled=false;button.textContent=withWeather?'◎ Capture GPS & weather':'⌖ Use phone GPS only';
  }
}
function applyManualGps(){
  let coords;
  try{coords=window.DistrictFlatwaterCoordinates.parse($('gps-latitude').value,$('gps-longitude').value);}
  catch(e){notify(e.message,true);return false;}
  cancelHistoricalPreview();
  ++contextToken; // Cancel any outstanding phone GPS/current-weather operation.
  draft.latitude=coords.latitude;draft.longitude=coords.longitude;
  draft.accuracy=null;draft.weather=null;draft.locationSource='manual';
  updateLocationUI();
  notify('Manual GPS coordinates applied. Use historical weather lookup for older catches.');
  return true;
}
function discardPreview(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
function updatePhotoPreview(){discardPreview();if(photoBlob){previewUrl=URL.createObjectURL(photoBlob);$('photo-preview').src=previewUrl;$('photo-preview').hidden=false;$('photo-placeholder').hidden=true;}else{$('photo-preview').removeAttribute('src');$('photo-preview').hidden=true;$('photo-placeholder').hidden=false;}updateIdentifyEnabled();}
function updateIdentifyEnabled(){$('identify-btn').disabled=!photoBlob||aiPending;}
async function optimizePhoto(file){
  if(!file||!(file.type||'').startsWith('image/'))throw Error('Please select an image.');
  if(file.size>35*1024*1024)throw Error('That image is too large (35 MB maximum).');
  let bitmap=null,objectUrl=null,image=null;
  try{
    if(typeof createImageBitmap==='function'){
      try{bitmap=await createImageBitmap(file);}catch(e){console.warn('ImageBitmap fallback:',e);}
    }
    if(!bitmap){
      objectUrl=URL.createObjectURL(file);
      image=await new Promise((resolve,reject)=>{
        const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Image is not supported by this phone. Try JPG or PNG.'));img.src=objectUrl;
      });
    }
    const width=bitmap?.width||image.naturalWidth,height=bitmap?.height||image.naturalHeight;
    if(!width||!height)throw Error('Photo has invalid dimensions.');
    const scale=Math.min(1,1600/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Photo processing unavailable on this device.');
    ctx.drawImage(bitmap||image,0,0,canvas.width,canvas.height);
    const result=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Unable to convert photo to JPEG.')),'image/jpeg',0.84));
    return result;
  }finally{bitmap?.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);}
}
function describeMetadata(meta){
  const items=[];
  if(meta?.date)items.push('Photo taken: '+(meta.date.offsetKnown?new Date(meta.date.iso).toLocaleString():meta.date.input.replace('T',' '))+(meta.date.offsetKnown?' (EXIF timezone)':' (camera time; no timezone)'));
  if(Number.isFinite(meta?.latitude)&&Number.isFinite(meta?.longitude))items.push('Photo GPS: '+meta.latitude.toFixed(5)+', '+meta.longitude.toFixed(5));
  return items.length?items.join(' · '):meta?.reason||'No usable capture date or GPS metadata found. Use the phone location button or enter time manually.';
}
function displayMetadata(meta){
  const box=$('metadata-panel'),actions=$('metadata-actions');
  box.hidden=false;selectedMetadata=meta;
  $('metadata-summary').textContent=describeMetadata(meta);
  const usable=!!meta?.date||(Number.isFinite(meta?.latitude)&&Number.isFinite(meta?.longitude));
  actions.hidden=!usable;
  $('metadata-apply').disabled=!usable;
}
function applyMetadata(){
  const meta=selectedMetadata;
  if(!meta)return;
  let used=[];
  cancelHistoricalPreview();
  if(meta.date){
    draft.weather=null;
    $('caught-at').value=meta.date.offsetKnown?nowLocal(meta.date.iso):meta.date.input;
    draft.capturedAt=localToIso($('caught-at').value)||meta.date.iso;
    draft.timeSource='photo-exif';
    updateLocationUI();used.push('capture date/time');
  }
  if(Number.isFinite(meta.latitude)&&Number.isFinite(meta.longitude)){
    ++contextToken; // invalidate any outstanding live GPS/weather request
    draft.latitude=meta.latitude;draft.longitude=meta.longitude;
    draft.accuracy=null;draft.weather=null;draft.locationSource='photo-exif';
    updateLocationUI();used.push('photo GPS');
  }
  $('metadata-actions').hidden=true;
  if(used.length){$('metadata-summary').textContent+=' · Applied: '+used.join(' and ')+'.';notify('Photo metadata applied. Review before saving.');}
}
async function selectPhoto(file){
  if(!file)return;
  const selection=++photoSelectionToken;
  try{
    // Read EXIF from the ORIGINAL image first: canvas processing removes it.
    const metadataPromise=window.DistrictFlatwaterPhotoMetadata?.read(file).catch(e=>({reason:'Cannot read photo metadata: '+(e?.message||String(e))}));
    const optimized=await optimizePhoto(file);
    if(selection!==photoSelectionToken)return;
    ++contextToken;
    cancelHistoricalPreview();
    photoBlob=optimized;draft.aiSuggestion=null;draft.aiConfidence=null;draft.scientificName=null;
    $('ai-result').hidden=true;
    if(!editingId){
      draft.capturedAt=new Date().toISOString();
      draft.latitude=null;draft.longitude=null;draft.accuracy=null;draft.weather=null;
      draft.timeSource='phone';draft.locationSource=null;
      $('caught-at').value=nowLocal(draft.capturedAt);
      updateLocationUI();
    }
    updatePhotoPreview();
    displayMetadata({reason:'Reading original photo metadata...'});
    const meta=await metadataPromise||{reason:'Photo metadata reader unavailable'};
    if(selection!==photoSelectionToken)return;
    displayMetadata(meta);
    notify('Photo ready. Review EXIF metadata or capture current GPS.');
  }catch(e){if(selection===photoSelectionToken)notify(e?.message||String(e),true);}
}
function blobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const result=String(reader.result);resolve(result.substring(result.indexOf(',')+1));};reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
function configuredProxy(){return localStorage.getItem('df-gemini-proxy')||'';}
async function identify(){const url=configuredProxy();if(!url){notify('Set the Gemini service URL in Settings first.',true);tab('settings');return;}if(!navigator.onLine){notify('Gemini identification requires internet.',true);return;}if(!photoBlob)return;aiPending=true;updateIdentifyEnabled();$('identify-btn').textContent='✦ Identifying...';
  try{const imageBase64=await blobBase64(photoBlob);const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);let response;try{response=await fetch(url.replace(/\/$/,'')+'/identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mimeType:'image/jpeg',imageBase64}),signal:controller.signal});}finally{clearTimeout(timeout);}const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||`Service returned ${response.status}`);
    const species=String(result.species||'').trim().slice(0,100),confidence=String(result.confidence||'low'),scientific=String(result.scientificName||'').trim().slice(0,120),note=String(result.note||'').trim().slice(0,250);draft.aiSuggestion=species;draft.aiConfidence=confidence;draft.scientificName=scientific;
    const r=$('ai-result');r.hidden=false;r.textContent=`Gemini suggests: ${species||'Unable to identify'}${scientific?' ('+scientific+')':''}. Confidence: ${confidence}.${note?' '+note:''}`;if(species && species.toLowerCase()!=='unknown'&&species.toLowerCase()!=='unidentified fish')$('species').value=species;notify('Review the AI suggestion before saving.');
  }catch(e){notify('Identification failed: '+e.message,true);}finally{aiPending=false;updateIdentifyEnabled();$('identify-btn').textContent='✦ Identify with Gemini';}}
function resetForm(){cancelHistoricalPreview();++contextToken;++photoSelectionToken;selectedMetadata=null;$('metadata-panel').hidden=true;editingId=null;draft=emptyDraft();photoBlob=null;updatePhotoPreview();$('species').value='';$('length').value='';$('weight').value='';$('lure').value='';$('notes').value='';$('caught-at').value=nowLocal(draft.capturedAt);$('ai-result').hidden=true;$('edit-label').hidden=true;$('cancel-edit').hidden=true;$('save-btn').textContent='Save catch';updateLocationUI();}
function reconcileEnteredGpsBeforeSave(){
  const latitude=$('gps-latitude').value.trim(),longitude=$('gps-longitude').value.trim();
  // Existing values are prefilled. If the user edits them, commit the edited
  // coordinates as manual GPS instead of silently retaining older phone GPS.
  if(!latitude&&!longitude){
    if(Number.isFinite(draft.latitude)&&Number.isFinite(draft.longitude)){
      notify('GPS fields are blank but this catch has a stored location. Enter both coordinates and select Use entered GPS before saving.',true);
      return false;
    }
    return true;
  }
  let coords;
  try{coords=window.DistrictFlatwaterCoordinates.parse(latitude,longitude);}
  catch(e){notify(e.message,true);return false;}
  if(draft.latitude===coords.latitude&&draft.longitude===coords.longitude)return true;
  return applyManualGps();
}
async function saveCatch(){const species=$('species').value.trim();const iso=localToIso($('caught-at').value);if(!photoBlob){notify('Add a catch photo first.',true);return;}if(!species){notify('Enter or confirm the fish species.',true);$('species').focus();return;}if(!iso){notify('Enter a valid catch date/time.',true);return;}
  if(!reconcileEnteredGpsBeforeSave())return;
  const length=$('length').value.trim(),weight=$('weight').value.trim();if((length&&(!Number.isFinite(+length)||+length<=0||+length>200))||(weight&&(!Number.isFinite(+weight)||+weight<=0||+weight>2000))){notify('Check the length or weight values.',true);return;}
  $('save-btn').disabled=true;try{const old=editingId?await getOne(editingId):null;const record={id:editingId||(typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')),species,capturedAt:iso,photo:photoBlob,latitude:draft.latitude,longitude:draft.longitude,accuracy:draft.accuracy,weather:draft.weather,aiSuggestion:draft.aiSuggestion,aiConfidence:draft.aiConfidence,scientificName:draft.scientificName,timeSource:draft.timeSource||null,locationSource:draft.locationSource||null,lengthIn:length?Number(length):null,weightLb:weight?Number(weight):null,lure:$('lure').value.trim(),notes:$('notes').value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};await putCatch(record);document.dispatchEvent(new CustomEvent('df-catches-changed',{detail:{kind:'save',id:record.id}}));notify(editingId?'Catch updated.':'Catch saved to this device.');resetForm();await refreshStats();tab('gallery');}catch(e){notify('Saving failed: '+(e?.message||String(e))+'. Check device storage and try a smaller photo.',true);}finally{$('save-btn').disabled=false;}}
async function refreshStats(){const data=await getAll();$('total-catches').textContent=String(data.length);$('total-species').textContent=String(new Set(data.map(x=>String(x.species||'').trim().toLowerCase()).filter(Boolean)).size);data.sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));$('latest-date').textContent=data.length?shortDate(data[0].capturedAt):'—';}
function node(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);return el;}
function appendInfo(parent,label,value){if(value===null||value===undefined||value==='')return;const p=node('p');const strong=node('strong',null,label+': ');p.append(strong,document.createTextNode(String(value)));parent.append(p);}
function releaseGalleryUrls(){for(const u of galleryUrls)URL.revokeObjectURL(u);galleryUrls=[];}
async function renderGallery(){const list=await getAll();const select=$('species-filter'),currentFilter=select.value,uniques=[...new Set(list.map(x=>x.species).filter(Boolean))].sort((a,b)=>a.localeCompare(b));select.replaceChildren(new Option('All species',''));for(const sp of uniques)select.add(new Option(sp,sp));if(uniques.includes(currentFilter))select.value=currentFilter;
  const f=select.value.toLowerCase();let rows=list.filter(x=>!f||x.species.toLowerCase()===f);const sort=$('sort-by').value;rows.sort((a,b)=>sort==='az'?a.species.localeCompare(b.species):sort==='za'?b.species.localeCompare(a.species):sort==='oldest'?Date.parse(a.capturedAt)-Date.parse(b.capturedAt):Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
  const grid=$('gallery-grid');releaseGalleryUrls();grid.replaceChildren();$('gallery-empty').hidden=rows.length>0;
  for(const item of rows){const card=node('article','catch-card');const img=node('img','photo');const url=URL.createObjectURL(item.photo);galleryUrls.push(url);img.src=url;img.alt='Catch photo: '+item.species;img.loading='lazy';const body=node('div','catch-body'),title=node('strong',null,item.species),date=node('small',null,prettyDate(item.capturedAt)),meta=node('div','meta',[(item.lengthIn?item.lengthIn+' in':''),(item.weightLb?item.weightLb+' lb':'')].filter(Boolean).join(' · ')||item.weather?.conditions||'Catch details');const actions=node('div','card-actions');
    const view=node('button',null,'View'),edit=node('button',null,'Edit'),del=node('button',null,'Delete');for(const b of [view,edit,del])b.type='button';view.addEventListener('click',()=>showCatch(item));edit.addEventListener('click',()=>editCatch(item.id));del.addEventListener('click',()=>deleteCatch(item.id));actions.append(view,edit,del);body.append(title,date,meta,actions);card.append(img,body);grid.append(card);
  }}
function showCatch(item){const box=$('dialog-content');box.replaceChildren();const img=node('img');const url=URL.createObjectURL(item.photo);img.src=url;img.alt=item.species;box.append(img,node('h3',null,item.species));appendInfo(box,'Date',prettyDate(item.capturedAt));if(item.timeSource==='photo-exif')appendInfo(box,'Date source','Original photo EXIF');if(item.locationSource==='photo-exif')appendInfo(box,'GPS source','Original photo EXIF');if(item.locationSource==='manual')appendInfo(box,'GPS source','Manual coordinates');if(item.locationSource==='phone')appendInfo(box,'GPS source','Phone at time of capture');if(Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)){const p=node('p');p.append(node('strong',null,'GPS: '));const a=node('a',null,`${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`);a.href=`https://www.google.com/maps?q=${encodeURIComponent(item.latitude+','+item.longitude)}`;a.target='_blank';a.rel='noopener noreferrer';p.append(a);box.append(p);}if(item.weather){appendInfo(box,'Weather source',item.weather.source||'Not specified');if(item.weather.historical&&item.weather.observedAt)appendInfo(box,'Historical hour',prettyDate(item.weather.observedAt));appendInfo(box,'Temperature',Number.isFinite(item.weather.temperatureF)?Math.round(item.weather.temperatureF)+' °F':null);appendInfo(box,'Surface pressure',Number.isFinite(item.weather.surfaceHpa)?(item.weather.surfaceHpa*.0295299830714).toFixed(2)+' inHg':null);appendInfo(box,'Conditions',item.weather.conditions);appendInfo(box,'Forecast',item.weather.forecast);}appendInfo(box,'Length',item.lengthIn?item.lengthIn+' in':null);appendInfo(box,'Weight',item.weightLb?item.weightLb+' lb':null);appendInfo(box,'Bait / lure',item.lure);appendInfo(box,'Notes',item.notes);if(item.aiSuggestion)appendInfo(box,'Gemini suggestion',item.aiSuggestion+' ('+(item.aiConfidence||'unknown')+' confidence)');$('catch-dialog').showModal();$('catch-dialog').addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}
async function editCatch(id){const item=await getOne(id);if(!item)return;cancelHistoricalPreview();editingId=id;++contextToken;draft={capturedAt:item.capturedAt,latitude:item.latitude,longitude:item.longitude,accuracy:item.accuracy,weather:item.weather,aiSuggestion:item.aiSuggestion||null,aiConfidence:item.aiConfidence||null,scientificName:item.scientificName||null,timeSource:item.timeSource||null,locationSource:item.locationSource||null};selectedMetadata=null;$('metadata-panel').hidden=true;photoBlob=item.photo;$('species').value=item.species;$('caught-at').value=nowLocal(item.capturedAt);$('length').value=item.lengthIn??'';$('weight').value=item.weightLb??'';$('lure').value=item.lure||'';$('notes').value=item.notes||'';$('ai-result').hidden=!item.aiSuggestion;if(item.aiSuggestion)$('ai-result').textContent='Previous Gemini suggestion: '+item.aiSuggestion;updatePhotoPreview();updateLocationUI();$('edit-label').hidden=false;$('cancel-edit').hidden=false;$('save-btn').textContent='Update catch';tab('log');}
async function deleteCatch(id){const item=await getOne(id);if(!item||!confirm(`Delete the ${item.species} catch from ${shortDate(item.capturedAt)}? This cannot be undone.`))return;await removeCatch(id);document.dispatchEvent(new CustomEvent('df-catches-changed',{detail:{kind:'delete',id}}));notify('Catch deleted.');await refreshStats();await renderGallery();}
async function exportBackup(){const catches=await getAll();$('export-btn').disabled=true;try{const rows=[];for(const c of catches){const {photo,...details}=c;rows.push({...details,photoDataUrl:`data:${photo.type||'image/jpeg'};base64,${await blobBase64(photo)}`});}const payload={application:'district-flatwater-fishing',formatVersion:1,exportedAt:new Date().toISOString(),catches:rows};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='district-flatwater-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notify(`Exported ${rows.length} catches.`);}catch(e){notify('Backup failed: '+e.message,true);}finally{$('export-btn').disabled=false;}}
function dataUrlToBlob(uri){const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(uri||'');if(!match)throw Error('Invalid photo in backup');const bin=atob(match[2]);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:match[1]});}
async function importBackup(file){if(!file)return;if(file.size>120*1024*1024){notify('Backup too large for this import. Split your archive.',true);return;}try{const data=JSON.parse(await file.text());if(data.application!=='district-flatwater-fishing'||data.formatVersion!==1||!Array.isArray(data.catches))throw Error('Unsupported District Flatwater backup format');if(data.catches.length>2000)throw Error('Too many catches in one import');let count=0;for(const c of data.catches){if(typeof c.id!=='string'||typeof c.species!=='string'||typeof c.capturedAt!=='string'||!c.photoDataUrl||!Number.isFinite(Date.parse(c.capturedAt)))throw Error('Backup contains an invalid catch');const {photoDataUrl,...record}=c;record.photo=dataUrlToBlob(photoDataUrl);record.species=record.species.slice(0,100);await putCatch(record);count++;}document.dispatchEvent(new CustomEvent('df-catches-changed',{detail:{kind:'import',count}}));await refreshStats();notify(`Imported ${count} catches.`);tab('gallery');}catch(e){notify('Import failed: '+e.message,true);}finally{$('import-file').value='';}}
function saveProxy(){const value=$('proxy-url').value.trim().replace(/\/$/,'');if(value){let u;try{u=new URL(value);}catch(_){notify('Enter a valid HTTPS service URL.',true);return;}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash){notify('Use only the HTTPS service base URL (no password or query).',true);return;}localStorage.setItem('df-gemini-proxy',u.href.replace(/\/$/,''));}else localStorage.removeItem('df-gemini-proxy');notify(value?'Gemini service URL saved.':'Gemini service URL cleared.');}
async function init(){try{db=await openDb();}catch(e){window.__DF_CATCH_APP_BOOT.storageError=String(e?.message||e);notify('Storage unavailable. Check private browsing settings.',true);return;}$('version').textContent=VERSION;resetForm();showNetwork();$('proxy-url').value=configuredProxy();for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>tab(button.dataset.tab));$('new-from-gallery').addEventListener('click',()=>{resetForm();tab('log');});$('take-photo').addEventListener('click',async()=>{if(!nativeBridge()?.pickPhoto){$('camera-input').click();return;}try{await selectPhoto(await nativeBridge().pickPhoto('camera'));}catch(e){notify('Camera: '+(e?.message||String(e)),true);}});
$('choose-photo').addEventListener('click',async()=>{if(!nativeBridge()?.pickPhoto){$('upload-input').click();return;}try{await selectPhoto(await nativeBridge().pickPhoto('gallery'));}catch(e){notify('Photo selection: '+(e?.message||String(e)),true);}});$('camera-input').addEventListener('change',e=>{selectPhoto(e.target.files[0]);e.target.value='';});$('upload-input').addEventListener('change',e=>{selectPhoto(e.target.files[0]);e.target.value='';});$('historical-lookup-btn').addEventListener('click',lookupHistoricalWeather);$('historical-apply-btn').addEventListener('click',applyHistoricalWeather);$('historical-discard-btn').addEventListener('click',()=>{$('historical-status').textContent='Historical weather result discarded; no changes made.';cancelHistoricalPreview();$('historical-status').textContent='Historical weather result discarded; no changes made.';});$('caught-at').addEventListener('input',()=>{cancelHistoricalPreview();if(draft.weather){draft.weather=null;updateLocationUI();}});$('metadata-apply').addEventListener('click',applyMetadata);$('metadata-skip').addEventListener('click',()=>{$('metadata-actions').hidden=true;$('metadata-summary').textContent+=' · Kept existing values. Use Capture GPS & weather for current location.';});$('manual-gps-btn').addEventListener('click',applyManualGps);$('phone-gps-btn').addEventListener('click',()=>captureLocation(false));$('location-btn').addEventListener('click',()=>captureLocation(true));$('weather-btn').addEventListener('click',()=>fetchWeather());$('identify-btn').addEventListener('click',identify);$('save-btn').addEventListener('click',saveCatch);$('cancel-edit').addEventListener('click',()=>{resetForm();tab('gallery');});$('species-filter').addEventListener('change',renderGallery);$('sort-by').addEventListener('change',renderGallery);$('save-proxy').addEventListener('click',saveProxy);$('export-btn').addEventListener('click',exportBackup);$('import-btn').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>importBackup(e.target.files[0]));document.addEventListener('df-edit-catch',event=>{const id=event.detail?.id;if(typeof id==='string'&&id)editCatch(id).catch(e=>notify('Cannot open catch: '+e.message,true));});window.addEventListener('online',showNetwork);window.addEventListener('offline',showNetwork);await refreshStats();window.__DF_CATCH_APP_BOOT.initialized=true;document.dispatchEvent(new Event('df-catch-ready'));if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
document.addEventListener('DOMContentLoaded',init);

})();
