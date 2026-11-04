/* District Flatwater Fishing Phase 3: local analytics, GPS fishing map, mobile navigation.
   Read-only against the existing IndexedDB database; do not migrate or delete records. */
(()=>{
'use strict';
const DB_NAME='district-flatwater-catches-v1', STORE='catches';
const $=id=>document.getElementById(id);
const el=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node;};
const niceDate=iso=>{const d=new Date(iso);return Number.isNaN(d.valueOf())?'Unknown date':d.toLocaleDateString();};
let catches=[],map=null,markers=null,loadingMap=false;
function readCatches(){if(!window.__DF_CATCH_APP_BOOT?.initialized)return Promise.resolve([]);return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE)){db.close();resolve([]);return;}const tx=db.transaction(STORE,'readonly'),get=tx.objectStore(STORE).getAll();get.onsuccess=()=>resolve(get.result||[]);get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close();};});}
function button(id,label,cls='button secondary'){const b=el('button',cls,label);b.id=id;b.type='button';return b;}
function panel(title){const p=el('div','panel');p.append(el('h3','',title));return p;}
function screen(name,title,eyebrow){const s=el('section','screen');s.id='screen-'+name;s.hidden=true;const head=el('div','section-title'),inner=el('div');inner.append(el('div','eyebrow',eyebrow),el('h2','',title));head.append(inner);s.append(head);return s;}
/* Navigation is centralized by app.js; this module reacts to navigation events. */
function stat(grid,label,value){const box=el('div','df-kpi');box.append(el('strong','',value),el('span','',label));grid.append(box);}
function chart(title,rows){const p=panel(title);if(!rows.length){p.append(el('div','df-empty','Log catches to see this chart.'));return p;}const max=Math.max(1,...rows.map(r=>r[1]));for(const [label,value] of rows){const line=el('div','df-chart-row'),cap=el('div','df-chart-label');cap.append(el('span','',label),el('strong','',value));const track=el('div','df-chart-track'),fill=el('div','df-chart-fill');fill.style.width=(value/max*100).toFixed(1)+'%';track.append(fill);line.append(cap,track);p.append(line);}return p;}
function counts(data,keyFn){const m=new Map();for(const item of data){const key=keyFn(item);if(key!==null&&key!==undefined&&key!=='')m.set(key,(m.get(key)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]);}
async function refresh(){try{catches=await readCatches();}catch(e){console.error('Unable to read catch log',e);const status=$('df-map-status');if(status)status.textContent='Unable to read saved catches: '+e.message;return;}if(!$('screen-analytics').hidden)renderAnalytics();if(!$('screen-map').hidden)renderLocations();}
function renderAnalytics(){const root=$('df-analytics-data');if(!root)return;root.replaceChildren();const grid=el('div','df-kpi-grid'),geo=catches.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)),pressure=catches.filter(c=>Number.isFinite(c.weather?.surfaceHpa));const species=counts(catches,c=>String(c.species||'').trim().toLowerCase());const months=counts(catches,c=>{const d=new Date(c.capturedAt);return Number.isNaN(d.getTime())?null:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');});stat(grid,'Total catches',catches.length);stat(grid,'Unique species',species.length);stat(grid,'GPS-tagged catches',geo.length);stat(grid,'Weather records',catches.filter(c=>c.weather).length);stat(grid,'Average surface pressure',pressure.length?(pressure.reduce((sum,c)=>sum+c.weather.surfaceHpa,0)/pressure.length*0.0295299830714).toFixed(2)+' inHg':'—');stat(grid,'Most recent catch',catches.length?niceDate([...catches].sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt))[0].capturedAt):'—');root.append(grid);
root.append(chart('Most caught species',counts(catches,c=>String(c.species||'Unknown').trim()||'Unknown').slice(0,12)));
root.append(chart('Catches by month',months.sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)));
root.append(chart('Time of day',counts(catches,c=>{const d=new Date(c.capturedAt);return Number.isNaN(d.getTime())?null:String(d.getHours()).padStart(2,'0')+':00';}).sort((a,b)=>a[0].localeCompare(b[0]))));
const ranges=[['Below 29.80',0],['29.80–29.99',0],['30.00–30.19',0],['30.20 and above',0]];for(const c of pressure){const x=c.weather.surfaceHpa*0.0295299830714;ranges[x<29.8?0:x<30?1:x<30.2?2:3][1]++;}root.append(chart('Catches by surface pressure (inHg)',ranges));root.append(el('p','df-analysis-note','Charts count logged catches only. They do not establish that particular times, weather conditions, or pressure readings cause fish to bite. Weather values are model estimates.'));
}
function filteredLocations(){return window.DistrictFlatwaterMapUtils.locations(catches,($('df-map-search')?.value||'').trim());}
function renderLocations(){
 const list=$('df-map-list');if(!list)return;list.replaceChildren();
 const rows=filteredLocations(),groups=window.DistrictFlatwaterMapUtils.groupPins(rows);
 $('df-map-status').textContent=rows.length+' geotagged catch'+(rows.length===1?'':'es')+' at '+groups.length+' distinct location'+(groups.length===1?'':'s')+'. '+(map?'Pins show the saved GPS locations.':'Tap Load interactive map to show pins.');
 if(!rows.length)list.append(el('div','df-empty','No GPS-tagged catches match. Check the saved coordinates.'));
 for(const c of rows.slice(0,100)){
  const item=el('div','df-map-item'),info=el('div');
  info.append(el('strong','',c.species||'Unidentified fish'),el('small','',niceDate(c.capturedAt)+' · '+c.latitude.toFixed(5)+', '+c.longitude.toFixed(5)));
  const link=el('a','', 'Open Maps');link.href='https://www.google.com/maps?q='+encodeURIComponent(c.latitude+','+c.longitude);
  link.target='_blank';link.rel='noopener noreferrer';item.append(info,link);list.append(item);
 }
 if(rows.length>100)list.append(el('p','df-analysis-note','Showing 100 recent catches in the list; the map includes every valid GPS-tagged catch.'));
 if(map)updateMarkers();
}
function addStyle(url){return new Promise((resolve,reject)=>{const tag=el('link');tag.rel='stylesheet';tag.href=url;tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});}
function addScript(url){return new Promise((resolve,reject)=>{const tag=el('script');tag.src=url;tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});}
function updateMarkers(){
 if(!map||!window.L)return;
 if(markers)map.removeLayer(markers);
 markers=L.featureGroup();
 const groups=window.DistrictFlatwaterMapUtils.groupPins(filteredLocations());
 for(const group of groups){
  const count=group.items.length;
  const icon=L.divIcon({className:'df-location-icon',
   html:'<span class="df-map-pin" aria-hidden="true">'+(count>1?String(count):'●')+'</span>',
   iconSize:[34,42],iconAnchor:[17,38],popupAnchor:[0,-32]});
  const marker=L.marker([group.latitude,group.longitude],{icon});
  const popup=el('div','df-map-popup');
  popup.append(el('strong','',count+' catch'+(count===1?'':'es')+' at this spot'),el('div','',group.latitude.toFixed(5)+', '+group.longitude.toFixed(5)));
  for(const record of group.items.slice(0,12))popup.append(el('div','',(record.species||'Unidentified fish')+' · '+niceDate(record.capturedAt)));
  if(count>12)popup.append(el('div','',(count-12)+' additional catches at this spot'));
  marker.bindPopup(popup);markers.addLayer(marker);
 }
 markers.addTo(map);
 if(groups.length===1)map.setView([groups[0].latitude,groups[0].longitude],13);
 else if(groups.length>1)map.fitBounds(markers.getBounds().pad(.22),{maxZoom:14});
 else map.setView([0,0],2);
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
  map=L.map('df-map',{scrollWheelZoom:false,zoomControl:true}).setView([0,0],2);
  let failures=0;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'})
   .on('tileerror',()=>{if(++failures===2)$('df-map-status').textContent='Background map tiles unavailable. Saved GPS pins remain positioned; check internet access.';})
   .addTo(map);
  b.hidden=true;
  await refresh();
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
 mp.append(el('p','df-privacy','The map is loaded on request. Its tiles are requested from OpenStreetMap and can reveal the areas you view to the map provider. Your catch records are not uploaded as a database.'));
 mp.append(button('df-load-map','Load interactive map'));
 const m=el('div');m.id='df-map';mp.append(m);
 const status=el('div');status.id='df-map-status';mp.append(status);locations.append(mp);
 const search=panel('Saved fishing locations'),label=el('label','','Filter by species'),input=el('input');
 label.htmlFor='df-map-search';input.id='df-map-search';input.placeholder='e.g. Largemouth bass';
 const list=el('div','df-map-list');search.append(label,input,list);locations.append(search);
 main.insertBefore(analytics,$('screen-settings'));main.insertBefore(locations,$('screen-settings'));
 $('df-load-map').addEventListener('click',loadMap);
 input.addEventListener('input',renderLocations);
 const reload=button('df-refresh-map','Refresh saved locations','button secondary compact');reload.addEventListener('click',refresh);search.append(reload);
 document.addEventListener('df-tab-change',event=>{
   if(event.detail?.name==='analytics')renderAnalytics();
   if(event.detail?.name==='map'){refresh();invalidateMap();}
 });
 $('tab-gallery')?.addEventListener('click',refresh);
 $('save-btn')?.addEventListener('click',()=>setTimeout(refresh,600));
 window.addEventListener('focus',()=>{if(window.__DF_CATCH_APP_BOOT?.initialized)refresh();});
 if(window.__DF_CATCH_APP_BOOT?.initialized)refresh();
 else document.addEventListener('df-catch-ready',refresh,{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
