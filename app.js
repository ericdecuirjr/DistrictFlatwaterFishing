/* App globals are scoped to prevent duplicate native/web script declaration crashes. */
(function districtFlatwaterCatchApp(){
'use strict';
if(window.__DF_CATCH_APP_BOOT) return;
window.__DF_CATCH_APP_BOOT={initialized:false,version:'3.12.0'};
/* District Flatwater Fishing — Phase 1. No frameworks or tracking. */
'use strict';
const VERSION = '3.12.0';
const DB_NAME = 'district-flatwater-catches-v1';
const STORE = 'catches';
const TRIPS = 'trips';
const SPOTS = 'spots';
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
      if(!database.objectStoreNames.contains(SPOTS))database.createObjectStore(SPOTS,{keyPath:'id'});
      if(!database.objectStoreNames.contains(TRIPS))database.createObjectStore(TRIPS,{keyPath:'id'});
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
      if(database.objectStoreNames.contains(STORE)&&database.objectStoreNames.contains(TRIPS)&&database.objectStoreNames.contains(SPOTS)){
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
function spotRows(){return new Promise((resolve,reject)=>{const r=db.transaction(SPOTS).objectStore(SPOTS).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function writeSpot(record,remove=false){return new Promise((resolve,reject)=>{const tx=db.transaction(SPOTS,'readwrite'),store=tx.objectStore(SPOTS);if(remove)store.delete(record.id);else store.put(record);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});}
function validateSpot(s){
 if(!s||typeof s.id!=='string'||!s.id||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!['want','fished'].includes(s.status))throw Error('Invalid saved spot');
 for(const [k,max] of [['waterbody',100],['access',1500],['launch',1500]])if(typeof s[k]!=='string'||s[k].length>max)throw Error('Invalid spot notes');
 const noGps=s.latitude===null&&s.longitude===null;
 if(!noGps&&(!Number.isFinite(s.latitude)||Math.abs(s.latitude)>90||!Number.isFinite(s.longitude)||Math.abs(s.longitude)>180))throw Error('Invalid spot coordinates');
 return s;
}
let spotEditingId=null;
function clearSpot(){spotEditingId=null;for(const id of ['spot-title','spot-waterbody','spot-access','spot-launch','spot-lat','spot-lon'])$(id).value='';$('spot-status').value='want';$('spot-save').textContent='Save spot';}
async function renderSpots(){
 const rows=await spotRows(),host=$('saved-spots-list');host.replaceChildren();
 const query=$('spot-search').value.trim().toLowerCase();
 if(!rows.length)host.append(node('p',null,'Save a place you want to try—even before your first catch.'));
 for(const spot of rows.filter(s=>[s.name,s.waterbody,s.access,s.launch].join(' ').toLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name))){
 const card=node('div','panel');card.append(node('h3',null,spot.name));appendInfo(card,'Waterbody',spot.waterbody);appendInfo(card,'Status',spot.status==='want'?'Want to try':'Fished');appendInfo(card,'Access notes',spot.access);appendInfo(card,'Kayak launch',spot.launch);
 if(Number.isFinite(spot.latitude)){const a=node('a','button ghost compact','Open location');a.href='https://www.google.com/maps?q='+encodeURIComponent(spot.latitude+','+spot.longitude);a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
 const edit=node('button','button secondary compact','Edit spot');edit.type='button';edit.onclick=()=>{spotEditingId=spot.id;for(const [id,key] of [['spot-title','name'],['spot-waterbody','waterbody'],['spot-access','access'],['spot-launch','launch'],['spot-lat','latitude'],['spot-lon','longitude'],['spot-status','status']])$(id).value=spot[key]??'';$('spot-save').textContent='Update spot';$('spot-title').focus();};
 const remove=node('button','button ghost compact','Delete spot');remove.type='button';remove.onclick=async()=>{if(!confirm('Delete '+spot.name+'? Your catches and trips will stay saved.'))return;try{await writeSpot(spot,true);if(spotEditingId===spot.id)clearSpot();await renderSpots();document.dispatchEvent(new Event('df-spots-changed'));}catch(e){notify('Could not delete spot: '+e.message,true);}};card.append(edit,remove);host.append(card);
 }
}
async function saveSpot(){
 const b=$('spot-save');if(b.disabled)return;b.disabled=true;
 try{let coords={latitude:null,longitude:null};if($('spot-lat').value.trim()||$('spot-lon').value.trim())coords=window.DistrictFlatwaterCoordinates.parse($('spot-lat').value,$('spot-lon').value);
 const record=validateSpot({id:spotEditingId||crypto.randomUUID(),name:$('spot-title').value.trim(),waterbody:$('spot-waterbody').value.trim(),status:$('spot-status').value,access:$('spot-access').value.trim(),launch:$('spot-launch').value.trim(),...coords,updatedAt:new Date().toISOString()});
 await writeSpot(record);clearSpot();await renderSpots();document.dispatchEvent(new Event('df-spots-changed'));notify('Fishing spot saved.');}catch(e){notify(e.message,true);}finally{b.disabled=false;}
}
function tripRows(){return new Promise((resolve,reject)=>{const r=db.transaction(TRIPS).objectStore(TRIPS).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function putTrip(record){return new Promise((resolve,reject)=>{const tx=db.transaction(TRIPS,'readwrite');tx.objectStore(TRIPS).put(record);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});}
// Detach catches and delete their trip in one transaction; photos and details stay intact.
function removeTrip(id){return new Promise((resolve,reject)=>{
 const tx=db.transaction([STORE,TRIPS],'readwrite');
 tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Trip deletion rolled back'));tx.onerror=()=>{};
 const catches=tx.objectStore(STORE),cursor=catches.openCursor();
 cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;if(row.value.tripId===id)row.update({...row.value,tripId:null});row.continue();};
 tx.objectStore(TRIPS).delete(id);
});}
async function deleteTrip(trip,button){
 if(!confirm(`Delete trip “${trip.name}”? All catches, photos, GPS and weather will stay in your catch log. This removes only the trip and its catch links.`))return;
 button.disabled=true;
 try{await removeTrip(trip.id);await renderTrips();await refreshStats();notify('Trip deleted. All catches and photos kept.');}
 catch(e){notify('Could not delete trip: '+e.message,true);}
 finally{button.disabled=false;}
}
let activeTrip=null;
async function renderTrips(){
 const trips=await tripRows(),catches=await getAll();activeTrip=trips.find(t=>!t.endedAt)||null;
 $('trip-start-fields').hidden=!!activeTrip;$('end-trip').hidden=!activeTrip;
 $('trip-status').textContent=activeTrip?`Fishing: ${activeTrip.name} · new catches join this trip`:'No active trip. Catches can also be logged on their own.';
 const host=$('trip-history');host.replaceChildren();
 for(const trip of trips.sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))){
 const rows=catches.filter(c=>c.tripId===trip.id),card=node('div','trip-summary');
 const minutes=Math.max(0,Math.round((Date.parse(trip.endedAt||new Date().toISOString())-Date.parse(trip.startedAt))/60000));
 card.append(node('strong',null,trip.name),node('p',null,`${prettyDate(trip.startedAt)} · ${trip.endedAt?'Completed':'Active'} · ${minutes} min · ${rows.length} catches`),node('p',null,[...new Set(rows.map(c=>c.species))].join(', ')||'No catches yet'));
 for(const row of rows){const b=node('button','button ghost compact',row.species+' · '+shortDate(row.capturedAt));b.type='button';b.onclick=()=>showCatch(row);card.append(b);}
 const remove=node('button','button ghost compact','Delete trip');remove.type='button';remove.setAttribute('aria-label','Delete trip '+trip.name);remove.onclick=()=>deleteTrip(trip,remove);card.append(remove);host.append(card);
 }
}
async function startTrip(){
 if($('start-trip').disabled)return;
 if(editingId){notify('Finish editing this catch before starting a trip.',true);return;}
 const name=$('trip-name').value.trim();if(!name){$('trip-name').focus();notify('Enter a trip or waterbody name.',true);return;}
 $('start-trip').disabled=true;try{if((await tripRows()).some(t=>!t.endedAt)){await renderTrips();return;}
 const trip={id:crypto.randomUUID(),name,startedAt:new Date().toISOString(),endedAt:null};await putTrip(trip);await renderTrips();notify('Trip started. New catches will join this trip.');}catch(e){notify('Could not start trip: '+e.message,true);}finally{$('start-trip').disabled=false;}
}
async function endTrip(){if(!activeTrip)return;try{await putTrip({...activeTrip,endedAt:new Date().toISOString()});await renderTrips();notify('Trip completed. Your catches are saved.');}catch(e){notify('Could not end trip: '+e.message,true);}}
function useTripContext(){
 if(!activeTrip?.context||!Number.isFinite(activeTrip.context.latitude)||!Number.isFinite(activeTrip.context.longitude)){notify('Save a catch with a location on this trip first.');return;}
 if(editingId){notify('Shared trip conditions apply to new catches only.',true);return;}
 const c=activeTrip.context;draft.latitude=c.latitude;draft.longitude=c.longitude;draft.accuracy=null;draft.weather=c.weather;draft.locationSource='trip';updateLocationUI();notify('Using the last saved trip location and conditions. Check them if you have moved.');
}
function rememberTackle(){try{localStorage.setItem('df-last-tackle',JSON.stringify({lure:$('lure').value.trim(),technique:$('technique').value.trim()}));}catch{}}
function fillTackle(){try{const t=JSON.parse(localStorage.getItem('df-last-tackle')||'{}');$('lure').value=t.lure||'';$('technique').value=t.technique||'';}catch{}}
function tab(name){
  const requested=$('screen-'+name)?name:'log';
  const navName=requested==='spots'?'more':['settings','diagnostics','analytics'].includes(requested)?'more':requested;
  document.querySelectorAll('main > .screen').forEach(screen=>{screen.hidden=screen.id!=='screen-'+requested;});
  // The branded banner now sits outside main and remains visible on every tab.
  document.querySelectorAll('#app-bottom-nav .bottom-nav-item').forEach(button=>{
    const active=button.dataset.tab===navName;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  if(requested==='spots')renderSpots();if(requested==='home')renderHome();if(requested==='log')renderTrips();if(requested==='gallery')renderGallery();if(requested==='settings')storageHealth();
  const heading=$('screen-'+requested)?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  document.dispatchEvent(new CustomEvent('df-tab-change',{detail:{name:requested}}));
  window.scrollTo({top:0,behavior:'instant'});
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
    draft.locationSource==='trip'?'Shared trip location; check if you have moved.':
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
function updatePhotoPreview(){if($('measure-photo'))$('measure-photo').disabled=!photoBlob;updateMeasurementLabel();discardPreview();if(photoBlob){previewUrl=URL.createObjectURL(photoBlob);$('photo-preview').src=previewUrl;$('photo-preview').hidden=false;$('photo-placeholder').hidden=true;}else{$('photo-preview').removeAttribute('src');$('photo-preview').hidden=true;$('photo-placeholder').hidden=false;}updateIdentifyEnabled();}
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
  if(!(Number.isFinite(meta?.latitude)&&Number.isFinite(meta?.longitude))&&meta?.reason)items.push(meta.reason);
  return items.length?items.join(' · '):meta?.reason||'No usable capture date or GPS metadata found.';
}
function displayMetadata(meta){
  const box=$('metadata-panel'),actions=$('metadata-actions');
  box.hidden=false;selectedMetadata=meta;
  $('metadata-summary').textContent=describeMetadata(meta);
  const hasGps=Number.isFinite(meta?.latitude)&&Number.isFinite(meta?.longitude);
  const usable=!!meta?.date||hasGps;
  $('choose-original').hidden=hasGps||!nativeBridge()?.pickOriginalFile;
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
    photoBlob=optimized;draft.photoMeasurement=null;$('length').value='';draft.aiSuggestion=null;draft.aiConfidence=null;draft.scientificName=null;
    $('ai-result').hidden=true;
    if(!editingId){
      draft.capturedAt=new Date().toISOString();
      // Keep only explicitly selected trip context when adding its photo.
      if(draft.locationSource!=='trip'){draft.latitude=null;draft.longitude=null;draft.accuracy=null;draft.weather=null;draft.locationSource=null;}
      draft.timeSource='phone';
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
function resetForm(){cancelHistoricalPreview();++contextToken;++photoSelectionToken;selectedMetadata=null;$('metadata-panel').hidden=true;$('choose-original').hidden=true;editingId=null;draft=emptyDraft();photoBlob=null;updatePhotoPreview();$('species').value='';$('length').value='';$('weight').value='';$('lure').value='';$('notes').value='';$('location-section').open=false;$('details-section').open=false;$('spot-name').value='';$('favorite-spot').checked=false;$('caught-at').value=nowLocal(draft.capturedAt);$('ai-result').hidden=true;$('edit-label').hidden=true;$('cancel-edit').hidden=true;$('save-btn').textContent='Save catch';$('save-another').hidden=false;fillTackle();updateLocationUI();}
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
async function saveCatch(logAnother=false){if($('save-btn').disabled)return;const species=$('species').value.trim();const iso=localToIso($('caught-at').value);if(!photoBlob){notify('Add a catch photo first.',true);return;}if(!species){notify('Enter or confirm the fish species.',true);$('species').focus();return;}if(!iso){notify('Enter a valid catch date/time.',true);return;}
  if(!reconcileEnteredGpsBeforeSave())return;
  const length=$('length').value.trim(),weight=$('weight').value.trim();if((length&&(!Number.isFinite(+length)||+length<=0||+length>200))||(weight&&(!Number.isFinite(+weight)||+weight<=0||+weight>2000))){notify('Check the length or weight values.',true);return;}
  $('save-btn').disabled=true;$('save-another').disabled=true;try{const old=editingId?await getOne(editingId):null;const record={...old,id:editingId||(typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')),species,tripId:old?.tripId||(!old?activeTrip?.id:null)||null,technique:$('technique').value.trim(),spotName:$('spot-name').value.trim(),favoriteSpot:$('favorite-spot').checked,capturedAt:iso,photo:photoBlob,latitude:draft.latitude,longitude:draft.longitude,accuracy:draft.accuracy,weather:draft.weather,aiSuggestion:draft.aiSuggestion,aiConfidence:draft.aiConfidence,scientificName:draft.scientificName,timeSource:draft.timeSource||null,locationSource:draft.locationSource||null,photoMeasurement:draft.photoMeasurement||null,lengthIn:length?Number(length):null,weightLb:weight?Number(weight):null,lure:$('lure').value.trim(),notes:$('notes').value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};await putCatch(record);  // Commit is complete: send the authoritative saved GPS to the map immediately.
  // Do not transfer photo data or request the phone's current location.
  document.dispatchEvent(new CustomEvent('df-catches-changed',{detail:{
    kind:old?'update':'save',id:record.id,
    catch:{id:record.id,species:record.species,capturedAt:record.capturedAt,
      latitude:record.latitude,longitude:record.longitude,locationSource:record.locationSource,
      weather:record.weather,lure:record.lure,spotName:record.spotName,favoriteSpot:record.favoriteSpot,updatedAt:record.updatedAt}
  }}));rememberTackle();
  if(!old&&activeTrip&&record.tripId===activeTrip.id&&Number.isFinite(record.latitude)&&Number.isFinite(record.longitude)){try{await putTrip({...activeTrip,context:{latitude:record.latitude,longitude:record.longitude,weather:record.weather}});}catch{notify('Catch saved; shared trip conditions could not be updated.',true);}}
notify(editingId?'Catch updated.':'Catch saved to this device.');resetForm();await refreshStats();await renderTrips();tab(logAnother?'log':'gallery');}catch(e){notify('Saving failed: '+(e?.message||String(e))+'. Check device storage and try a smaller photo.',true);}finally{$('save-btn').disabled=false;$('save-another').disabled=false;}}
async function refreshStats(){const data=await getAll();$('total-catches').textContent=String(data.length);$('total-species').textContent=String(new Set(data.map(x=>String(x.species||'').trim().toLowerCase()).filter(Boolean)).size);data.sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));$('latest-date').textContent=data.length?shortDate(data[0].capturedAt):'—';}
let homeUrls=[];
async function renderHome(){
 const host=$('home-recent');if(!host)return;
 const rows=(await getAll()).sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)).slice(0,3);
 for(const url of homeUrls)URL.revokeObjectURL(url);homeUrls=[];host.replaceChildren();
 if(!rows.length){const empty=node('div','empty');empty.append(node('h3',null,'Your first catch starts here'),node('p',null,'Add a photo to build your private fishing logbook.'));host.append(empty);return;}
 for(const item of rows){const button=node('button','recent-catch');button.type='button';const img=node('img');const url=URL.createObjectURL(item.photo);homeUrls.push(url);img.src=url;img.alt='';const copy=node('span');copy.append(node('strong',null,item.species),node('small',null,shortDate(item.capturedAt)+(item.spotName?' · '+item.spotName:'')),node('small',null,item.lengthIn?(item.photoMeasurement?'~':'')+item.lengthIn+' in':'View catch →'));button.append(img,copy);button.onclick=()=>showCatch(item);host.append(button);}
}
function node(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);return el;}
function appendInfo(parent,label,value){if(value===null||value===undefined||value==='')return;const p=node('p');const strong=node('strong',null,label+': ');p.append(strong,document.createTextNode(String(value)));parent.append(p);}
function releaseGalleryUrls(){for(const u of galleryUrls)URL.revokeObjectURL(u);galleryUrls=[];}
async function renderGallery(){const list=await getAll();const select=$('species-filter'),currentFilter=select.value,uniques=[...new Set(list.map(x=>x.species).filter(Boolean))].sort((a,b)=>a.localeCompare(b));select.replaceChildren(new Option('All species',''));for(const sp of uniques)select.add(new Option(sp,sp));if(uniques.includes(currentFilter))select.value=currentFilter;
  const f=select.value.toLowerCase();const query=$('catch-search').value.trim().toLowerCase();let rows=list.filter(x=>(!f||x.species.toLowerCase()===f)&&(!query||[x.species,x.spotName,x.lure,x.technique,x.notes].some(v=>String(v||'').toLowerCase().includes(query))));const sort=$('sort-by').value;rows.sort((a,b)=>sort==='az'?a.species.localeCompare(b.species):sort==='za'?b.species.localeCompare(a.species):sort==='oldest'?Date.parse(a.capturedAt)-Date.parse(b.capturedAt):Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
  const grid=$('gallery-grid');releaseGalleryUrls();grid.replaceChildren();$('gallery-empty').hidden=rows.length>0;
  for(const item of rows){const card=node('article','catch-card');const img=node('img','photo');const url=URL.createObjectURL(item.photo);galleryUrls.push(url);img.src=url;img.alt='Catch photo: '+item.species;img.loading='lazy';const body=node('div','catch-body'),title=node('strong',null,item.species),date=node('small',null,prettyDate(item.capturedAt)),meta=node('div','meta',[(item.lengthIn?(item.photoMeasurement?'~':'')+item.lengthIn+' in':''),(item.weightLb?item.weightLb+' lb':'')].filter(Boolean).join(' · ')||item.weather?.conditions||'Catch details');const actions=node('div','card-actions');
    const view=node('button',null,'View'),edit=node('button',null,'Edit'),del=node('button',null,'Delete');for(const b of [view,edit,del])b.type='button';view.addEventListener('click',()=>showCatch(item));edit.addEventListener('click',()=>editCatch(item.id));del.addEventListener('click',()=>deleteCatch(item.id));actions.append(view);const spot=node('small',null,(item.favoriteSpot?'★ ':'')+(item.spotName||''));body.append(title,date,meta,spot,actions);card.append(img,body);grid.append(card);
  }}
function showCatch(item){const box=$('dialog-content');box.replaceChildren();const img=node('img');const url=URL.createObjectURL(item.photo);img.src=url;img.alt=item.species;box.append(img,node('h3',null,item.species));appendInfo(box,'Date',prettyDate(item.capturedAt));if(item.timeSource==='photo-exif')appendInfo(box,'Date source','Original photo EXIF');if(item.locationSource==='photo-exif')appendInfo(box,'GPS source','Original photo EXIF');if(item.locationSource==='manual')appendInfo(box,'GPS source','Manual coordinates');if(item.locationSource==='phone')appendInfo(box,'GPS source','Phone at time of capture');if(Number.isFinite(item.latitude)&&Number.isFinite(item.longitude)){const p=node('p');p.append(node('strong',null,'GPS: '));const a=node('a',null,`${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`);a.href=`https://www.google.com/maps?q=${encodeURIComponent(item.latitude+','+item.longitude)}`;a.target='_blank';a.rel='noopener noreferrer';p.append(a);box.append(p);}if(item.weather){appendInfo(box,'Weather source',item.weather.source||'Not specified');if(item.weather.historical&&item.weather.observedAt)appendInfo(box,'Historical hour',prettyDate(item.weather.observedAt));appendInfo(box,'Temperature',Number.isFinite(item.weather.temperatureF)?Math.round(item.weather.temperatureF)+' °F':null);appendInfo(box,'Surface pressure',Number.isFinite(item.weather.surfaceHpa)?(item.weather.surfaceHpa*.0295299830714).toFixed(2)+' inHg':null);appendInfo(box,'Conditions',item.weather.conditions);appendInfo(box,'Forecast',item.weather.forecast);}appendInfo(box,item.photoMeasurement?'Estimated length (photo reference)':'Length',item.lengthIn?item.lengthIn+' in':null);const measure=node('button',null,'Measure photo');measure.type='button';measure.addEventListener('click',async()=>{$('catch-dialog').close();await editCatch(item.id);openPhotoMeasurement();});box.append(measure);appendInfo(box,'Weight',item.weightLb?item.weightLb+' lb':null);appendInfo(box,'Bait / lure',item.lure);appendInfo(box,'Technique',item.technique);if(item.tripId)tripRows().then(rows=>appendInfo(box,'Trip',rows.find(t=>t.id===item.tripId)?.name));if(item.locationSource==='trip')appendInfo(box,'GPS source','Shared trip location');appendInfo(box,'Spot',item.spotName);appendInfo(box,'Favorite spot',item.favoriteSpot?'Yes':null);appendInfo(box,'Notes',item.notes);const actions=node('div','detail-actions');for(const [label,action] of [['Edit catch',()=>editCatch(item.id)],['Delete catch',()=>deleteCatch(item.id)]]){const button=node('button','button secondary',label);button.type='button';button.onclick=()=>{$('catch-dialog').close();action();};actions.append(button);}box.append(actions);if(item.aiSuggestion)appendInfo(box,'Gemini suggestion',item.aiSuggestion+' ('+(item.aiConfidence||'unknown')+' confidence)');$('catch-dialog').showModal();$('catch-dialog').addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}
async function editCatch(id){const item=await getOne(id);if(!item)return;cancelHistoricalPreview();editingId=id;++contextToken;draft={photoMeasurement:item.photoMeasurement||null,capturedAt:item.capturedAt,latitude:item.latitude,longitude:item.longitude,accuracy:item.accuracy,weather:item.weather,aiSuggestion:item.aiSuggestion||null,aiConfidence:item.aiConfidence||null,scientificName:item.scientificName||null,timeSource:item.timeSource||null,locationSource:item.locationSource||null};selectedMetadata=null;$('metadata-panel').hidden=true;photoBlob=item.photo;$('species').value=item.species;$('caught-at').value=nowLocal(item.capturedAt);$('length').value=item.lengthIn??'';$('weight').value=item.weightLb??'';$('lure').value=item.lure||'';$('technique').value=item.technique||'';$('save-another').hidden=true;$('notes').value=item.notes||'';$('spot-name').value=item.spotName||'';$('favorite-spot').checked=!!item.favoriteSpot;$('ai-result').hidden=!item.aiSuggestion;if(item.aiSuggestion)$('ai-result').textContent='Previous Gemini suggestion: '+item.aiSuggestion;updatePhotoPreview();updateLocationUI();$('location-section').open=true;$('details-section').open=true;$('edit-label').hidden=false;$('cancel-edit').hidden=false;$('save-btn').textContent='Update catch';tab('log');}
async function deleteCatch(id){const item=await getOne(id);if(!item||!confirm(`Delete the ${item.species} catch from ${shortDate(item.capturedAt)}? This cannot be undone.`))return;await removeCatch(id);document.dispatchEvent(new CustomEvent('df-catches-changed',{detail:{kind:'delete',id}}));notify('Catch deleted.');await refreshStats();await renderGallery();}
async function exportBackup(){const catches=await getAll();$('export-btn').disabled=true;try{const rows=[];for(const c of catches){const {photo,...details}=c;rows.push({...details,photoDataUrl:`data:${photo.type||'image/jpeg'};base64,${await blobBase64(photo)}`});}const payload={application:'district-flatwater-fishing',formatVersion:1,exportedAt:new Date().toISOString(),trips:await tripRows(),spots:await spotRows(),catches:rows};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='district-flatwater-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);localStorage.setItem('df-last-backup',new Date().toISOString());storageHealth();notify(`Backup download requested for ${rows.length} catches, ${payload.trips.length} trips and ${payload.spots.length} spots. Keep the downloaded file somewhere safe.`);}catch(e){notify('Backup failed: '+e.message,true);}finally{$('export-btn').disabled=false;}}
function dataUrlToBlob(uri){const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(uri||'');if(!match)throw Error('Invalid photo in backup');const bin=atob(match[2]);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:match[1]});}
async function importBackup(file){
 if(!file)return;
 $('import-btn').disabled=true;
 try{
  if(file.size>120*1024*1024)throw Error('Backup too large for this import.');
  const data=JSON.parse(await file.text());
  if(data.application!=='district-flatwater-fishing'||data.formatVersion!==1||!Array.isArray(data.catches)||data.catches.length>2000)throw Error('Unsupported backup format or catch count');
  // Validate and decode EVERY record before opening any write transaction.
  const ids=new Set(),rows=data.catches.map(c=>{
   if(!c||typeof c.id!=='string'||!c.id.trim()||ids.has(c.id)||typeof c.species!=='string'||!c.species.trim()||!Number.isFinite(Date.parse(c.capturedAt)))throw Error('Invalid catch or duplicate ID in backup');
   ids.add(c.id);const {photoDataUrl,...record}=c;record.photo=dataUrlToBlob(photoDataUrl);
   if(!record.photo.size)throw Error('Empty photo in backup');
   return record;
  });
  const trips=data.trips||[];const tripIds=new Set();if(!Array.isArray(trips)||trips.length>10000)throw Error('Invalid trips');for(const t of trips){if(!t||typeof t.id!=='string'||!t.id||tripIds.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>100||!Number.isFinite(Date.parse(t.startedAt))||(t.endedAt!==null&&!Number.isFinite(Date.parse(t.endedAt))))throw Error('Invalid trip');tripIds.add(t.id);}
  const spots=data.spots??[];if(!Array.isArray(spots)||spots.length>10000)throw Error('Invalid saved spots');const spotIds=new Set();for(const spot of spots){validateSpot(spot);if(spotIds.has(spot.id))throw Error('Duplicate spot ID');spotIds.add(spot.id);}
  const existing=new Set((await getAll()).map(c=>c.id));
  const added=rows.filter(c=>!existing.has(c.id)).length;
  if(!confirm(`Backup checked: ${rows.length} catches with photos and ${trips.length} trips and ${spots.length} saved spots. Add ${added} new catches? Existing matching catches will be kept. Nothing will be deleted.`))return;
  // The read and add are in one transaction: concurrent saves cannot be overwritten.
  let count=0;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction([STORE,TRIPS,SPOTS],'readwrite'),store=tx.objectStore(STORE);
   const spotStore=tx.objectStore(SPOTS);for(const spot of spots){const r=spotStore.get(spot.id);r.onsuccess=()=>{if(!r.result)spotStore.add(spot);};}
   const tripStore=tx.objectStore(TRIPS);for(const trip of trips){const req=tripStore.get(trip.id);req.onsuccess=()=>{if(!req.result)tripStore.add({id:trip.id,name:trip.name,startedAt:trip.startedAt,endedAt:trip.endedAt||new Date().toISOString(),context:null});};}
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Restore rolled back'));tx.onerror=()=>{};
   for(const record of rows){const req=store.get(record.id);req.onsuccess=()=>{if(!req.result){store.add(record);count++;}};}
  });
  document.dispatchEvent(new CustomEvent('df-catches-changed',{detail:{kind:'import',count}}));
  document.dispatchEvent(new Event('df-spots-changed'));await renderTrips();await refreshStats();notify(`Restored ${count} catches. Kept ${rows.length-count} existing matches.`);tab('gallery');
 }catch(e){notify('Import failed; no partial restore: '+e.message,true);}
 finally{$('import-file').value='';$('import-btn').disabled=false;}
}
async function storageHealth(){
 const status=$('backup-status');if(!status)return;
 try{const rows=await getAll(),estimate=await navigator.storage?.estimate?.(),persistent=await navigator.storage?.persisted?.();
 const last=localStorage.getItem('df-last-backup');
 status.textContent=`${rows.length} catches on this device. Last backup download requested: ${last?prettyDate(last):'Never'}. `+(estimate?.quota?`Storage: ${Math.round(estimate.usage/1048576)} MB of ${Math.round(estimate.quota/1048576)} MB. `:'')+(persistent?'Persistent storage enabled.':'Export regularly to protect against device or browser data loss.');
 }catch{status.textContent='Storage status unavailable. Export a backup regularly.';}
}
function saveProxy(){const value=$('proxy-url').value.trim().replace(/\/$/,'');if(value){let u;try{u=new URL(value);}catch(_){notify('Enter a valid HTTPS service URL.',true);return;}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash){notify('Use only the HTTPS service base URL (no password or query).',true);return;}localStorage.setItem('df-gemini-proxy',u.href.replace(/\/$/,''));}else localStorage.removeItem('df-gemini-proxy');notify(value?'Gemini service URL saved.':'Gemini service URL cleared.');}

function updateMeasurementLabel(){if($('measurement-status'))$('measurement-status').textContent=draft.photoMeasurement?'Length estimated from a photo reference. Save the catch to keep it.':'Length may be entered manually or estimated using a known-size photo reference.';}
async function openPhotoMeasurement(){
 if(!photoBlob)return;
 try{const {measurePhoto}=await import('./photo-measurement-ui.mjs');const result=await measurePhoto(photoBlob,draft.photoMeasurement);if(!result)return;
 const inches=result.unit==='cm'?result.length/2.54:result.length;
 if(inches>200){notify('Estimated length exceeds 200 inches. Check the reference and endpoints.',true);return;}
 $('details-section').open=true;draft.photoMeasurement=result;$('length').value=String(Math.round(inches*10)/10);updateMeasurementLabel();notify('Estimated length applied. Save the catch to keep it.');
 }catch(e){notify('Measurement: '+e.message,true);}
}

async function init(){try{db=await openDb();}catch(e){window.__DF_CATCH_APP_BOOT.storageError=String(e?.message||e);notify('Storage unavailable. Check private browsing settings.',true);return;}window.DistrictFlatwaterSpots={getAll:spotRows};$('spot-save').onclick=saveSpot;$('spot-clear').onclick=clearSpot;$('spot-search').oninput=renderSpots;$('spot-phone').onclick=()=>{if(!navigator.geolocation){notify('Phone GPS unavailable.',true);return;}navigator.geolocation.getCurrentPosition(p=>{$('spot-lat').value=p.coords.latitude;$('spot-lon').value=p.coords.longitude;},e=>notify('GPS: '+e.message,true),{enableHighAccuracy:true,timeout:15000});};$('version').textContent=VERSION;resetForm();showNetwork();$('proxy-url').value=configuredProxy();for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>tab(button.dataset.tab));$('home-log').addEventListener('click',()=>{resetForm();tab('log');});$('catch-search').addEventListener('input',renderGallery);$('new-from-gallery').addEventListener('click',()=>{resetForm();tab('log');});$('take-photo').addEventListener('click',async()=>{if(!nativeBridge()?.pickPhoto){$('camera-input').click();return;}try{await selectPhoto(await nativeBridge().pickPhoto('camera'));}catch(e){notify('Camera: '+(e?.message||String(e)),true);}});
$('choose-photo').addEventListener('click',async()=>{if(!nativeBridge()?.pickPhoto){$('upload-input').click();return;}try{await selectPhoto(await nativeBridge().pickPhoto('gallery'));}catch(e){notify('Photo selection: '+(e?.message||String(e)),true);}});$('choose-original').addEventListener('click',async()=>{if(!nativeBridge()?.pickOriginalFile)return;try{await selectPhoto(await nativeBridge().pickOriginalFile());}catch(e){if(!/cancel/i.test(String(e?.message||e)))notify('Original photo: '+(e?.message||String(e)),true);}});$('camera-input').addEventListener('change',e=>{selectPhoto(e.target.files[0]);e.target.value='';});$('upload-input').addEventListener('change',e=>{selectPhoto(e.target.files[0]);e.target.value='';});$('historical-lookup-btn').addEventListener('click',lookupHistoricalWeather);$('historical-apply-btn').addEventListener('click',applyHistoricalWeather);$('historical-discard-btn').addEventListener('click',()=>{$('historical-status').textContent='Historical weather result discarded; no changes made.';cancelHistoricalPreview();$('historical-status').textContent='Historical weather result discarded; no changes made.';});$('caught-at').addEventListener('input',()=>{cancelHistoricalPreview();if(draft.weather){draft.weather=null;updateLocationUI();}});$('metadata-apply').addEventListener('click',applyMetadata);$('metadata-skip').addEventListener('click',()=>{$('metadata-actions').hidden=true;$('metadata-summary').textContent+=' · Kept existing values. Use Capture GPS & weather for current location.';});$('manual-gps-btn').addEventListener('click',applyManualGps);$('phone-gps-btn').addEventListener('click',()=>captureLocation(false));$('location-btn').addEventListener('click',()=>captureLocation(true));$('weather-btn').addEventListener('click',()=>fetchWeather());$('identify-btn').addEventListener('click',identify);$('measure-photo').addEventListener('click',openPhotoMeasurement);$('length').addEventListener('input',()=>{draft.photoMeasurement=null;updateMeasurementLabel();});$('save-btn').addEventListener('click',()=>saveCatch(false));$('save-another').addEventListener('click',()=>saveCatch(true));$('start-trip').addEventListener('click',startTrip);$('end-trip').addEventListener('click',endTrip);$('use-trip-context').addEventListener('click',useTripContext);$('cancel-edit').addEventListener('click',()=>{resetForm();tab('gallery');});$('species-filter').addEventListener('change',renderGallery);$('sort-by').addEventListener('change',renderGallery);$('save-proxy').addEventListener('click',saveProxy);$('protect-storage').addEventListener('click',async()=>{try{await navigator.storage?.persist?.();await storageHealth();}catch{notify('Storage protection unavailable; export a backup.',true);}});$('export-btn').addEventListener('click',exportBackup);$('import-btn').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',e=>importBackup(e.target.files[0]));document.addEventListener('df-edit-catch',event=>{const id=event.detail?.id;if(typeof id==='string'&&id)editCatch(id).catch(e=>notify('Cannot open catch: '+e.message,true));});window.addEventListener('online',showNetwork);window.addEventListener('offline',showNetwork);await renderTrips();await refreshStats();await renderHome();window.__DF_CATCH_APP_BOOT.initialized=true;document.dispatchEvent(new Event('df-catch-ready'));if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
document.addEventListener('DOMContentLoaded',init);

})();

