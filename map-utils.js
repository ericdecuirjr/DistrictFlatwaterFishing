/* Read-only map helpers — pins are derived solely from saved catch records.
   No current-location lookup, GPS fallback, or IndexedDB mutation is performed here. */
(()=>{
'use strict';
const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
function coordinate(value,limit){
  if(typeof value==='string'){
    const trimmed=value.trim();
    if(!decimal.test(trimmed))return null;
    value=Number(trimmed);
  }
  return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=limit?value:null;
}
function pinKey(latitude,longitude){
  const lat=coordinate(latitude,90),lon=coordinate(longitude,180);
  return lat===null||lon===null?null:lat.toFixed(6)+','+lon.toFixed(6);
}
function sourceLabel(source){
  if(source==='photo-exif')return 'Photo EXIF';
  if(source==='manual')return 'Manual entry';
  if(source==='phone')return 'Phone GPS at time of logging';
  return 'Unspecified (older catch)';
}
function sourceCounts(records){
  const counts={photoExif:0,manual:0,phone:0,unspecified:0};
  for(const record of records){
    if(record.locationSource==='photo-exif')counts.photoExif++;
    else if(record.locationSource==='manual')counts.manual++;
    else if(record.locationSource==='phone')counts.phone++;
    else counts.unspecified++;
  }
  return counts;
}
function locations(records,query='',options={}){
  const filter=String(query||'').trim().toLowerCase();
  if(!Array.isArray(records))return [];
  return records.reduce((all,record)=>{
    if(!record||typeof record!=='object')return all;
    const latitude=coordinate(record.latitude,90),longitude=coordinate(record.longitude,180);
    if(latitude===null||longitude===null)return all;
    if(filter&&!String(record.species||'').toLowerCase().includes(filter))return all;
    if(options.favoriteOnly&&!record.favoriteSpot)return all;
    if(options.lure&&!String(record.lure||'').toLowerCase().includes(String(options.lure).toLowerCase()))return all;
    if(options.spot&&!String(record.spotName||'').toLowerCase().includes(String(options.spot).toLowerCase()))return all;
    // Normalize for map display only. Do not update the saved record.
    all.push({...record,latitude,longitude});
    return all;
  },[]).sort((a,b)=>(Date.parse(b.capturedAt)||0)-(Date.parse(a.capturedAt)||0));
}
function groupPins(records){
  const groups=new Map();
  for(const record of records){
    const key=pinKey(record.latitude,record.longitude);
    if(key===null)continue;
    let group=groups.get(key);
    if(!group){
      group={key,latitude:coordinate(record.latitude,90),longitude:coordinate(record.longitude,180),items:[]};
      groups.set(key,group);
    }
    group.items.push(record);
  }
  return [...groups.values()];
}
// Apply a confirmed transaction immediately, even before IndexedDB is read again.
// Only the original saved coordinates are accepted. No phone GPS is consulted.
function reconcileCommitted(records,change){
  const previous=Array.isArray(records)?records:[];
  if(!change||typeof change!=='object'||typeof change.id!=='string')return previous;
  if(change.kind==='delete')return previous.filter(row=>row?.id!==change.id);
  if(change.kind!=='save'&&change.kind!=='update')return previous;
  const record=change.catch;
  if(!record||record.id!==change.id)return previous;
  return [...previous.filter(row=>row?.id!==change.id),record];
}
window.DistrictFlatwaterMapUtils={coordinate,pinKey,sourceLabel,sourceCounts,locations,groupPins,reconcileCommitted};
})();