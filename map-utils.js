/* Pure fishing-map helpers: normalize only trustworthy GPS coordinates,
   filter by species, and group catches that share a pin location. */
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
function locations(records,query=''){
  const filter=String(query||'').trim().toLowerCase();
  if(!Array.isArray(records))return [];
  return records.reduce((all,record)=>{
    if(!record||typeof record!=='object')return all;
    const latitude=coordinate(record.latitude,90);
    const longitude=coordinate(record.longitude,180);
    if(latitude===null||longitude===null)return all;
    if(filter&&!String(record.species||'').toLowerCase().includes(filter))return all;
    all.push({...record,latitude,longitude});
    return all;
  },[]).sort((a,b)=>(Date.parse(b.capturedAt)||0)-(Date.parse(a.capturedAt)||0));
}
function groupPins(records){
  const groups=new Map();
  for(const record of records){
    const lat=coordinate(record.latitude,90),lon=coordinate(record.longitude,180);
    if(lat===null||lon===null)continue;
    // 6 decimals ~0.11m; multiple catches at the same spot share a visible pin.
    const key=lat.toFixed(6)+','+lon.toFixed(6);
    let group=groups.get(key);
    if(!group){
      group={latitude:lat,longitude:lon,items:[]};
      groups.set(key,group);
    }
    group.items.push(record);
  }
  return [...groups.values()];
}
window.DistrictFlatwaterMapUtils={coordinate,locations,groupPins};
})();