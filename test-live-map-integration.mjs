/* Browser-like integration regression for saved catch -> visible Leaflet pins.
 * Runs in Node with faked DOM, IndexedDB and Leaflet; never accesses user data.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const listeners=new Map(), registry=new Map();
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.hidden=false;this.value='';this.textContent='';this.style={};this.className='';this.disabled=false;}
 set id(v){this._id=v;if(v)registry.set(v,this);}
 get id(){return this._id||'';}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 insertBefore(item){this.children.push(item);}
 addEventListener(type,fn){this['on'+type]=fn;}
 setAttribute(key,val){this[key]=val;}
 get classList(){return {add(){},remove(){},toggle(){}};}
}
const main=new Element('main');
for(const id of ['screen-settings','screen-log','screen-gallery','df-map-search','df-map-status']){
 const el=new Element('div');el.id=id;
}
const fakeDocument={
 readyState:'complete',
 createElement(tag){return new Element(tag);},
 getElementById(id){return registry.get(id)||null;},
 querySelector(sel){return sel==='main'?main:null;},
 addEventListener(type,fn){(listeners.get(type)||listeners.set(type,[]).get(type)).push(fn);},
 dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}
};
const saved=[{id:'first',species:'Bass',latitude:38.8895,longitude:-77.0353,
 capturedAt:'2026-10-01T10:00:00Z',locationSource:'manual'}];
const indexedDB={
 open(){
  const req={};
  queueMicrotask(()=>{
   req.result={
    objectStoreNames:{contains:()=>true},close(){},
    transaction(){
     const tx={objectStore(){return {getAll(){
      const get={};
      queueMicrotask(()=>{get.result=[...saved];get.onsuccess?.();tx.oncomplete?.();});
      return get;
     }};}};
     return tx;
    }
   };
   req.onsuccess?.();
  });
  return req;
 }
};
const calls={created:0,markers:0,center:null,fit:0};
const leaflet={
 map(){calls.created++;return {
  setView(coords){calls.center=coords;return this;},
  fitBounds(){calls.fit++;return this;},
  removeLayer(){},invalidateSize(){},
 };},
 featureGroup(){const layer={pins:[],addLayer(pin){this.pins.push(pin);},
  addTo(){calls.markers=this.pins.length;return this;},
  getBounds(){return {pad(){return this;}}}
 };return layer;},
 marker(coords){return {coords,bindPopup(){return this;},openPopup(){return this;}};},
 divIcon(opts){return opts;},
 tileLayer(){return {on(){return this;},addTo(){return this;}};}
};
const windowObj={__DF_CATCH_APP_BOOT:{initialized:true},L:leaflet,
 DistrictFlatwaterNative:{isNative:true},addEventListener(){}};
const sandbox={window:windowObj,document:fakeDocument,indexedDB,
 navigator:{onLine:true},console,Date,Map,Number,String,Array,Math,Promise,
 requestAnimationFrame:fn=>fn(),CustomEvent:class {constructor(type,opts){this.type=type;this.detail=opts?.detail;} },
 L:leaflet};
vm.runInNewContext(readFileSync('map-utils.js','utf8'),sandbox,{filename:'map-utils.js'});
vm.runInNewContext(readFileSync('phase3.js','utf8'),sandbox,{filename:'phase3.js'});
const flush=async()=>{for(let i=0;i<18;i++)await new Promise(resolve=>setImmediate(resolve));};
await flush();
const mapScreen=registry.get('screen-map');
assert.ok(mapScreen,'Map screen initialized');
mapScreen.hidden=false;
fakeDocument.dispatchEvent({type:'df-tab-change',detail:{name:'map'}});
await flush();
assert.equal(calls.created,1,'Map initializes when opened');
assert.equal(calls.markers,1,'Initial saved catch creates one marker');
assert.ok(registry.get('df-map-list'),'Saved location list has the DOM ID required by renderLocations');
assert.equal(registry.get('df-map-list').children.length,1,'Initial GPS location appears in saved list');

const newer={id:'second',species:'Trout',latitude:35.11,longitude:-80.92,
 capturedAt:'2026-11-04T12:00:00Z',locationSource:'manual'};
saved.push(newer);
fakeDocument.dispatchEvent({type:'df-catches-changed',detail:{
 kind:'save',id:newer.id,catch:{...newer}
}});
assert.equal(calls.markers,2,'New saved GPS pin added synchronously while app remains open');
assert.equal(registry.get('df-map-list').children.length,2,'New saved location appears in list without restart');
await flush();
assert.equal(calls.created,1,'Existing Leaflet map is retained');
assert.equal(calls.markers,2,'Database reconciliation does not remove the new pin');

const relocated={...newer,latitude:29.76,longitude:-95.36};
saved[1]=relocated;
fakeDocument.dispatchEvent({type:'df-catches-changed',detail:{
 kind:'update',id:newer.id,catch:relocated
}});
assert.equal(calls.markers,2,'Edited catch has exactly two unique pins');
await flush();
assert.equal(calls.markers,2);

const filter=registry.get('df-map-search');
filter.value='bass';
const latest={id:'third',species:'Pike',latitude:42.36,longitude:-71.06,
 capturedAt:'2026-11-04T13:00:00Z',locationSource:'photo-exif'};
saved.push(latest);
fakeDocument.dispatchEvent({type:'df-catches-changed',detail:{kind:'save',id:latest.id,catch:latest}});
assert.equal(filter.value,'','Stale species filter cleared for new catch');
assert.equal(calls.markers,3,'New species pin is visible immediately');
assert.equal(registry.get('df-map-list').children.length,3,'Species filter reset keeps all saved locations listed');
await flush();
assert.equal(calls.markers,3);

saved.splice(1,1);
fakeDocument.dispatchEvent({type:'df-catches-changed',detail:{kind:'delete',id:'second'}});
assert.equal(calls.markers,2,'Deleted catch pin removed without restart');
await flush();
assert.equal(calls.created,1);
console.log('Live catch save/edit/delete -> visible GPS map integration passed');
