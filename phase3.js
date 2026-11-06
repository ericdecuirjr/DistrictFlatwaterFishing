/* District Flatwater Fishing Phase 3: local analytics, GPS fishing map, mobile navigation.
   Read-only against the existing IndexedDB database; do not migrate or delete records. */
(()=>{
'use strict';
const DB_NAME='district-flatwater-catches-v1', STORE='catches';
const $=id=>document.getElementById(id);
const el=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node;};
const niceDate=iso=>{const d=new Date(iso);return Number.isNaN(d.valueOf())?'Unknown date':d.toLocaleDateString();};
let catches=[],map=null,markers=null,loadingMap=false;
let markerByKey=new Map();
let refreshSequence=0;
let liveSyncMessage='';
function readCatches(){if(!window.__DF_CATCH_APP_BOOT?.initialized)return Promise.resolve([]);return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE)){db.close();resolve([]);return;}const tx=db.transaction(STORE,'readonly'),get=tx.objectStore(STORE).getAll();get.onsuccess=()=>resolve(get.result||[]);get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close();};});}
function button(id,label,cls='button secondary'){const b=el('button',cls,label);b.id=id;b.type='button';return b;}
function panel(title){const p=el('div','panel');p.append(el('h3','',title));return p;}
function screen(name,title,eyebrow){const s=el('section','screen');s.id='screen-'+name;s.hidden=true;const head=el('div','section-title'),inner=el('div');inner.append(el('div','eyebrow',eyebrow),el('h2','',title));head.append(inner);s.append(head);return s;}
/* Navigation is centralized by app.js; this module reacts to navigation events. */
function stat(grid,label,value){const box=el('div','df-kpi');box.append(el('strong','',value),el('span','',label));grid.append(box);}
function chart(title,rows){const p=panel(title);if(!rows.length){p.append(el('div','df-empty','Log catches to see this chart.'));return p;}const max=Math.max(1,...rows.map(r=>r[1]));for(const [label,value] of rows){const line=el('div','df-chart-row'),cap=el('div','df-chart-label');cap.append(el('span','',label),el('strong','',value));const track=el('div','df-chart-track'),fill=el('div','df-chart-fill');fill.style.width=(value/max*100).toFixed(1)+'%';track.append(fill);line.append(cap,track);p.append(line);}return p;}
function counts(data,keyFn){const m=new Map();for(const item of data){const key=keyFn(item);if(key!==null&&key!==undefined&&key!=='')m.set(key,(m.get(key)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]);}
async function refresh(){
 const sequence=++refreshSequence;
 let rows;
 try{rows=await readCatches();}
 catch(e){
  if(sequence===refreshSequence){
   console.error('Unable to read catch log',e);
   const status=$('df-map-status');
   if(status)status.textContent='Unable to read saved catches: '+e.message;
  }
  return false;
 }
 // Prevent an older async IndexedDB read from overwriting newer saved catches.
 if(sequence!==refreshSequence)return false;
 catches=rows;
 if(!$('screen-analytics').hidden)renderAnalytics();
 if(!$('screen-map').hidden)renderLocations();
 return true;
}
function renderAnalytics(){const root=$('df-analytics-data');if(!root)return;root.replaceChildren();const grid=el('div','df-kpi-grid'),geo=catches.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)),pressure=catches.filter(c=>Number.isFinite(c.weather?.surfaceHpa));const species=counts(catches,c=>String(c.species||'').trim().toLowerCase());const months=counts(catches,c=>{const d=new Date(c.capturedAt);return Number.isNaN(d.getTime())?null:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');});stat(grid,'Total catches',catches.length);stat(grid,'Unique species',species.length);stat(grid,'GPS-tagged catches',geo.length);stat(grid,'Weather records',catches.filter(c=>c.weather).length);stat(grid,'Average surface pressure',pressure.length?(pressure.reduce((sum,c)=>sum+c.weather.surfaceHpa,0)/pressure.length*0.0295299830714).toFixed(2)+' inHg':'—');stat(grid,'Most recent catch',catches.length?niceDate([...catches].sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt))[0].capturedAt):'—');root.append(grid);
root.append(chart('Most caught species',counts(catches,c=>String(c.species||'Unknown').trim()||'Unknown').slice(0,12)));
root.append(chart('Catches by month',months.sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)));
root.append(chart('Time of day',counts(catches,c=>{const d=new Date(c.capturedAt);return Number.isNaN(d.getTime())?null:String(d.getHours()).padStart(2,'0')+':00';}).sort((a,b)=>a[0].localeCompare(b[0]))));
const ranges=[['Below 29.80',0],['29.80–29.99',0],['30.00–30.19',0],['30.20 and above',0]];for(const c of pressure){const x=c.weather.surfaceHpa*0.0295299830714;ranges[x<29.8?0:x<30?1:x<30.2?2:3][1]++;}root.append(chart('Catches by surface pressure (inHg)',ranges));root.append(el('p','df-analysis-note','Charts count logged catches only. They do not establish that particular times, weather conditions, or pressure readings cause fish to bite. Weather values are model estimates.'));
}
function filteredLocations(){return window.DistrictFlatwaterMapUtils.locations(catches,($('df-map-search')?.value||'').trim(),{lure:$('df-map-lure')?.value,spot:$('df-map-spot')?.value,favoriteOnly:$('df-map-favorite')?.checked});}
function canLoadMap(){return !!window.DistrictFlatwaterNative||navigator.onLine;}
function renderLocations(){
 const list=$('df-map-list'),status=$('df-map-status');
 if(!list||!status)return;
 list.replaceChildren();
 const rows=filteredLocations();
 const groups=window.DistrictFlatwaterMapUtils.groupPins(rows);
 const counts=window.DistrictFlatwaterMapUtils.sourceCounts(rows);
 let summary=rows.length+' saved GPS-tagged catch'+(rows.length===1?'':'es')+' at '+groups.length+' distinct location'+(groups.length===1?'':'s')+'. ';
 if(rows.length)summary+='Source: '+counts.photoExif+' photo EXIF, '+counts.manual+' manual, '+counts.phone+' phone, '+counts.unspecified+' unspecified.';
 else summary+='No saved GPS coordinates match this filter. The map does not use your current phone location.';
 status.textContent=summary;
 const live=$('df-map-live-status');
 if(live)live.textContent=liveSyncMessage||'Map synchronized with saved catch records.';
 const intro=$('df-map-source-note');
 if(intro)intro.textContent=rows.length?
  'Pins below are built only from coordinates in SAVED catch records. Phone-derived GPS means the phone location was saved when that catch was logged; it is not a fresh location lookup.':
  'No pins to display. Open a saved catch in Gallery → Edit to add or correct GPS coordinates.';
 if(!rows.length){
   list.append(el('div','df-empty','No saved catch locations match. There is no automatic phone-location fallback.'));
 }
 for(const record of rows.slice(0,100)){
   const item=el('div','df-map-item'),info=el('div');
   const label=window.DistrictFlatwaterMapUtils.sourceLabel(record.locationSource);
   info.append(el('strong','',(record.favoriteSpot?'★ ':'')+(record.spotName?record.spotName+' · ':'')+(record.species||'Unidentified fish')),
     el('small','',niceDate(record.capturedAt)+' · '+record.latitude.toFixed(6)+', '+record.longitude.toFixed(6)),
     el('small','', 'GPS source: '+label));
   const controls=el('div','df-map-item-controls');
   const focus=button('','Show pin','button secondary compact');
   focus.addEventListener('click',()=>focusSavedPin(record));
   const google=el('a','', 'Open Maps');
   google.href='https://www.google.com/maps?q='+encodeURIComponent(record.latitude+','+record.longitude);
   google.target='_blank';google.rel='noopener noreferrer';
   const edit=button('','Edit GPS','button secondary compact');
   edit.addEventListener('click',()=>{
     if(typeof record.id==='string'&&record.id)
       document.dispatchEvent(new CustomEvent('df-edit-catch',{detail:{id:record.id}}));
   });
   controls.append(focus,edit,google);
   item.append(info,controls);list.append(item);
 }
 if(rows.length>100)list.append(el('p','df-analysis-note','Showing 100 recent catches in the list. The map includes every matching saved catch.'));
 if(map)updateMarkers();
}
async function focusSavedPin(record){
 const lat=window.DistrictFlatwaterMapUtils.coordinate(record.latitude,90);
 const lon=window.DistrictFlatwaterMapUtils.coordinate(record.longitude,180);
 if(lat===null||lon===null)return;
 if(!map){
   await loadMap();
   if(!map)return;
 }
 invalidateMap();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(!map)return;
   map.setView([lat,lon],15,{animate:false});
   const key=window.DistrictFlatwaterMapUtils.pinKey(lat,lon);
   const pin=markerByKey.get(key);
   if(pin)pin.openPopup();
 }));
}
function addStyle(url){return new Promise((resolve,reject)=>{const tag=el('link');tag.rel='stylesheet';tag.href=url;tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});}
function addScript(url){return new Promise((resolve,reject)=>{const tag=el('script');tag.src=url;tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});}
function updateMarkers(){
 if(!map||!window.L)return;
 if(markers)map.removeLayer(markers);
 markers=L.featureGroup();markerByKey=new Map();
 const groups=window.DistrictFlatwaterMapUtils.groupPins(filteredLocations());
 for(const group of groups){
   const count=group.items.length;
   const icon=L.divIcon({
     className:'df-location-icon',
     html:'<span class="df-map-pin" aria-hidden="true">'+(count>1?String(count):'●')+'</span>',
     iconSize:[34,42],iconAnchor:[17,38],popupAnchor:[0,-32]
   });
   const marker=L.marker([group.latitude,group.longitude],{icon});
   const popup=el('div','df-map-popup');
   popup.append(el('strong','',count+' saved catch'+(count===1?'':'es')+' at this spot'),
     el('div','',group.latitude.toFixed(6)+', '+group.longitude.toFixed(6)));
   for(const record of group.items.slice(0,12)){
     popup.append(el('div','',(record.species||'Unidentified fish')+' · '+niceDate(record.capturedAt)+' · '+window.DistrictFlatwaterMapUtils.sourceLabel(record.locationSource)));
   }
   if(count>12)popup.append(el('div','',(count-12)+' additional catches at this spot'));
   marker.bindPopup(popup);markerByKey.set(group.key,marker);markers.addLayer(marker);
 }
 markers.addTo(map);
 // Never center on phone GPS, a hard-coded location, or (0,0) as a fallback.
 if(groups.length===1)map.setView([groups[0].latitude,groups[0].longitude],13,{animate:false});
 else if(groups.length>1)map.fitBounds(markers.getBounds().pad(.22),{maxZoom:14,animate:false});
 invalidateMap();
}
function invalidateMap(){
 if(!map)return;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(map)map.invalidateSize({pan:false});}));
}
async function loadMap(){
 if(loadingMap)return;
 if(map){await refresh();invalidateMap();return;}
 loadingMap=true;
 const b=$('df-load-map');b.disabled=true;b.textContent='Loading map...';
 try{
  // Native APK bundles Leaflet so marker rendering does not depend on an external JS CDN.
  if(!window.L){
   const local=!!window.DistrictFlatwaterNative;
   await addStyle(local?'./vendor/leaflet.css':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
   await addScript(local?'./vendor/leaflet.js':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  }
  if(!window.L)throw Error('Map library did not initialize');
  // Fetch the committed records before deciding where to create the map.
  await refresh();
  const selected=window.DistrictFlatwaterMapUtils.groupPins(filteredLocations());
  if(!selected.length){
    $('df-map-status').textContent='No saved GPS pins to plot. The map does not substitute the phone location.';
    b.disabled=false;b.textContent='Load interactive map';
    return;
  }
  map=L.map('df-map',{scrollWheelZoom:false,zoomControl:true}).setView([selected[0].latitude,selected[0].longitude],13,{animate:false});
  let failures=0;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'})
   .on('tileerror',()=>{if(++failures===2)$('df-map-status').textContent='Background map tiles unavailable. Saved GPS pins remain positioned; check internet access.';})
   .addTo(map);
  b.hidden=true;
  updateMarkers();invalidateMap();
 }catch(e){
  $('df-map-status').textContent='Unable to display map: '+e.message+'. Saved fishing locations remain listed below.';
  b.disabled=false;b.textContent='Try loading map again';
 }finally{loadingMap=false;}
}
function init(){
 const main=document.querySelector('main');if(!main)return;
 const analytics=screen('analytics','Catch analytics','FISHING PATTERNS'),locations=screen('map','Fishing locations','YOUR WATER');
 const data=el('div');data.id='df-analytics-data';analytics.append(data);
 const mp=panel('Catch map');
 mp.append(el('p','df-privacy','Opening the Map tab loads map tiles when online. Tiles come from OpenStreetMap and can reveal the area shown to the provider. Your catch database and photos are not uploaded.'));
 const provenance=el('p','df-privacy');provenance.id='df-map-source-note';
 provenance.textContent='Only coordinates in saved catch records are used for map pins. Current phone GPS is never read from the Map screen.';
 mp.append(provenance);
 mp.append(button('df-load-map','Load interactive map'));
 const m=el('div');m.id='df-map';mp.append(m);
 const status=el('div');status.id='df-map-status';mp.append(status);
 const live=el('p','df-map-live-status');live.id='df-map-live-status';live.setAttribute('role','status');
 live.textContent='Map synchronized with saved catch records.';mp.append(live);
 locations.append(mp);
 const search=panel('Saved fishing locations'),label=el('label','','Filter by species'),input=el('input');
 label.htmlFor='df-map-search';input.id='df-map-search';input.placeholder='e.g. Largemouth bass';
 const list=el('div','df-map-list');list.id='df-map-list';search.append(label,input,list);locations.append(search);
 main.insertBefore(analytics,$('screen-settings'));main.insertBefore(locations,$('screen-settings'));
 $('df-load-map').addEventListener('click',loadMap);
 input.addEventListener('input',renderLocations);
 for(const [id,title,type] of [['df-map-lure','Filter by bait / lure','text'],['df-map-spot','Filter by spot name','text'],['df-map-favorite','Favorite spots only','checkbox']]){const label=el('label','',title),control=el('input');control.id=id;control.type=type;label.htmlFor=id;search.insertBefore(label,list);search.insertBefore(control,list);control.addEventListener('input',renderLocations);}
 const reload=button('df-refresh-map','Refresh saved locations','button secondary compact');reload.addEventListener('click',refresh);search.append(reload);
 document.addEventListener('df-tab-change',event=>{
   if(event.detail?.name==='analytics')renderAnalytics();
   if(event.detail?.name==='map'){
     refresh().then(current=>{
       if(!current)return;
       if(map){invalidateMap();return;}
       // Opening Map is an explicit request to view map tiles and saved pins.
       // No live phone GPS is ever requested by this feature.
       if(filteredLocations().length&&canLoadMap()&&!loadingMap)loadMap();
     });
   }
 });
 $('tab-gallery')?.addEventListener('click',refresh);
 document.addEventListener('df-catches-changed',event=>{
   // Receipt is after an IndexedDB commit; update the in-memory pin data NOW.
   // An older pending read cannot roll the markers back after this change.
   ++refreshSequence;
   const change=event.detail||{};
   const filter=$('df-map-search');
   if((change.kind==='save'||change.kind==='update')&&filter?.value){
     // A stale species filter can make a new saved location look absent.
     filter.value='';
   }
   catches=window.DistrictFlatwaterMapUtils.reconcileCommitted(catches,change);
   const locs=filteredLocations();
   liveSyncMessage='Latest committed change: '+(change.kind||'updated')+
     '. '+locs.length+' GPS-tagged catches; '+
     window.DistrictFlatwaterMapUtils.groupPins(locs).length+' map pin locations.';
   if(!$('screen-map').hidden)renderLocations();
   if(!$('screen-analytics').hidden)renderAnalytics();
   // Reconcile against the full authoritative database (including photos)
   // after applying the immediate marker update.
   refresh().then(current=>{
     if(!current||$('screen-map').hidden)return;
     if(map){invalidateMap();return;}
     if(filteredLocations().length&&canLoadMap()&&!loadingMap)loadMap();
   });
 });
 window.addEventListener('focus',()=>{if(window.__DF_CATCH_APP_BOOT?.initialized)refresh();});
 if(window.__DF_CATCH_APP_BOOT?.initialized)refresh();
 else document.addEventListener('df-catch-ready',refresh,{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
