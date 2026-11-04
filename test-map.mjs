/* Offline GPS pin tests: never reads or changes the user's catch database. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},Map,Number,String,Date,Array,Math};
vm.runInNewContext(readFileSync('map-utils.js','utf8'),sandbox,{filename:'map-utils.js'});
const {coordinate,locations,groupPins}=sandbox.window.DistrictFlatwaterMapUtils;
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
assert.ok(phase.includes("event.detail?.name==='map'){refresh();invalidateMap();}"),'Map tab must refresh catches before showing pins');
assert.ok(phase.includes('groupPins(filteredLocations())'),'Pins must be grouped from filtered GPS locations');
assert.ok(phase.includes("'./vendor/leaflet.js'"),'Native build should use locally bundled Leaflet');
assert.ok(phase.includes('invalidateSize'),'Hidden-to-visible map needs size refresh');
assert.ok(phase.includes('df-map-pin'),'Marker should not rely on CDN icon PNG');
console.log('GPS location filtering, overlapping map pins and map navigation checks passed');
