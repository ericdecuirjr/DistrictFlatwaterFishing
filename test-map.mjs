/* Offline GPS pin tests: never reads or changes the user's catch database. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},Map,Number,String,Date,Array,Math};
vm.runInNewContext(readFileSync('map-utils.js','utf8'),sandbox,{filename:'map-utils.js'});
const {coordinate,locations,groupPins,sourceCounts,sourceLabel,pinKey}=sandbox.window.DistrictFlatwaterMapUtils;
assert.equal(coordinate(0,90),0);
assert.equal(coordinate('-77.0353',180),-77.0353);
assert.equal(coordinate('38.8895',90),38.8895);
assert.equal(coordinate('',90),null);
assert.equal(coordinate('bad',90),null);
assert.equal(coordinate('Infinity',90),null);
assert.equal(coordinate(91,90),null);
assert.equal(coordinate(-181,180),null);
const catches=[
 {id:'a',species:'Bass',latitude:38.8895,longitude:-77.0353,capturedAt:'2026-05-01T12:00:00Z'},
 {id:'b',species:'Bass',latitude:'38.8895',longitude:'-77.0353',capturedAt:'2026-05-02T12:00:00Z'},
 {id:'c',species:'Trout',latitude:41.1,longitude:-72.5,capturedAt:'2026-05-03T12:00:00Z'},
 {id:'d',species:'Unknown',latitude:91,longitude:-72.5,capturedAt:'2026-05-04T12:00:00Z'},
 {id:'e',species:'Unknown',latitude:null,longitude:null,capturedAt:'2026-05-04T12:00:00Z'},
 {id:'f',species:'Bass',latitude:0,longitude:0,capturedAt:'2026-05-06T12:00:00Z'}
];
const all=locations(catches);
assert.equal(all.length,4);
assert.equal(locations(catches,'bass').length,3);
const groups=groupPins(all);
assert.equal(groups.length,3);
assert.equal(groups.find(g=>g.latitude===38.8895)?.items.length,2);
assert.ok(groups.some(g=>g.latitude===0&&g.longitude===0));
const phase=readFileSync('phase3.js','utf8');
assert.ok(phase.includes("event.detail?.name==='map'"),'Map tab handler exists');
assert.ok(phase.includes("if(filteredLocations().length&&canLoadMap()&&!loadingMap)loadMap()"),'Entering Map auto-loads saved GPS pins when available');
assert.ok(phase.includes("function canLoadMap(){return !!window.DistrictFlatwaterNative||navigator.onLine;}"),'Native map pin rendering can initialize offline');
assert.ok(phase.includes('refreshSequence'),'Async catch list reloads reject outdated results');
assert.ok(phase.includes('groupPins(filteredLocations())'),'Pins must be grouped from filtered GPS locations');
assert.ok(phase.includes("'./vendor/leaflet.js'"),'Native build should use locally bundled Leaflet');
assert.ok(phase.includes('invalidateSize'),'Hidden-to-visible map needs size refresh');
assert.ok(phase.includes('df-map-pin'),'Marker should not rely on CDN icon PNG');
console.log('GPS location filtering, overlapping map pins and map navigation checks passed');

const sourceRows=locations([
 {id:'exif',species:'Bass',latitude:39.25,longitude:-76.75,locationSource:'photo-exif'},
 {id:'manual',species:'Bass',latitude:'28.25',longitude:'-82.75',locationSource:'manual'},
 {id:'phone',species:'Bass',latitude:40,longitude:-75,locationSource:'phone'},
 {id:'legacy',species:'Bass',latitude:45,longitude:-70}
]);
const provenance=sourceCounts(sourceRows);
assert.equal(provenance.photoExif,1);
assert.equal(provenance.manual,1);
assert.equal(provenance.phone,1);
assert.equal(provenance.unspecified,1);
assert.equal(sourceLabel('phone'),'Phone GPS at time of logging');
assert.equal(pinKey(39.25,-76.75),'39.250000,-76.750000');
assert.equal(pinKey(null,-76.75),null);
const stage=readFileSync('phase3.js','utf8');
const logging=readFileSync('app.js','utf8');
assert.ok(!stage.includes('navigator.geolocation')&&!stage.includes('getCurrentPosition'),'Map never requests live phone GPS');
assert.ok(!stage.includes('setView([0,0],2'),'Map must not invent a default geographic center');
assert.ok(stage.includes("locationSource"),'Map shows GPS source');
assert.ok(stage.includes('Saved GPS'),'Map labels saved GPS records');
assert.ok(stage.includes('df-edit-catch'),'Map offers GPS correction via catch editor');
assert.ok(logging.includes('reconcileEnteredGpsBeforeSave()'),'Save must reconcile manual GPS fields');
assert.ok(logging.includes("document.addEventListener('df-edit-catch'"),'Map editor opens saved catch in app');
console.log('Saved GPS provenance, map source isolation, and manual-entry safeguards passed');

assert.ok(/await putCatch\(record\);\s*\/\/ Commit is complete:[\s\S]{0,420}document\.dispatchEvent\(new CustomEvent\('df-catches-changed'/.test(logging),
 'Saved catch event must include committed coordinates and dispatch after transaction');
assert.ok(logging.includes('latitude:record.latitude,longitude:record.longitude'),'Save notification must include exactly the saved GPS coordinates');
const deleteLine=logging.match(/await removeCatch\(id\);.{0,150}/)?.[0]||'';
assert.ok(deleteLine.includes("document.dispatchEvent(new CustomEvent('df-catches-changed'"),'Delete should refresh map after transaction');
assert.ok(stage.includes("document.addEventListener('df-catches-changed'"),'Map must subscribe to committed catch changes');
assert.ok(!stage.includes("setTimeout(refresh,600"),'Map must not refresh on arbitrary Save-button timer');
assert.ok(stage.includes('if(sequence!==refreshSequence)return false'),'Stale DB reads must not overwrite latest catch set');
assert.ok(stage.includes('if(map)updateMarkers()'),'Existing map pins update without recreating map');
assert.ok(stage.includes('if(map){invalidateMap();return;}'),'Map reuses already-loaded tiles and pins');
console.log('Live map refresh on committed catches and map tab navigation passed');

const reconcileCommitted=sandbox.window.DistrictFlatwaterMapUtils.reconcileCommitted;
const originalRecords=[
 {id:'one',latitude:38.8895,longitude:-77.0353,species:'Bass'},
 {id:'two',latitude:39.25,longitude:-76.61,species:'Trout'}
];
const newRecord={id:'three',latitude:33.7,longitude:-84.4,species:'Bass',locationSource:'manual'};
const merged=reconcileCommitted(originalRecords,{kind:'save',id:'three',catch:newRecord});
assert.equal(merged.length,3,'Committed save adds the new catch immediately');
assert.equal(groupPins(locations(merged)).length,3,'New GPS creates a new pin without app restart');
assert.equal(originalRecords.length,2,'Existing array is not mutated');
const amended=reconcileCommitted(merged,{kind:'update',id:'three',catch:{...newRecord,latitude:35.2,longitude:-80.8}});
assert.ok(groupPins(locations(amended)).some(g=>g.latitude===35.2),'Moved catch pin uses new saved GPS');
assert.ok(!groupPins(locations(amended)).some(g=>g.latitude===33.7),'Old pin is removed on update');
const deleted=reconcileCommitted(amended,{kind:'delete',id:'three'});
assert.equal(groupPins(locations(deleted)).length,2);
const currentPhase=readFileSync('phase3.js','utf8');
assert.ok(currentPhase.includes("catches=window.DistrictFlatwaterMapUtils.reconcileCommitted(catches,change)"),'Committed catches are inserted into live map cache without awaiting another database read');
assert.ok(currentPhase.includes("filter.value=''"),'Stale species filter is reset so saved GPS pin is visible');
assert.ok(currentPhase.includes("if(!$('screen-map').hidden)renderLocations()"),'Visible map is rerendered immediately');
assert.ok(currentPhase.includes("++refreshSequence;"),'Pending stale reads are invalidated on committed catch event');
assert.ok(currentPhase.includes('df-map-live-status'),'Map shows live synchronization status');
assert.ok(currentPhase.includes("const list=el('div','df-map-list');list.id='df-map-list';"),'Map location-list element must have the ID used by renderLocations');
assert.ok(currentPhase.includes("const list=$('df-map-list'),status=$('df-map-status');"),'Location rendering uses the registered DOM list');
console.log('Live save→map reconciliation, stale filter, pin move/delete tests passed');
