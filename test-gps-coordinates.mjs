/* Pure input tests: neither network nor catch database is accessed. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const sandbox={window:{},String,Number,Error,Math};
vm.runInNewContext(readFileSync('gps-coordinates.js','utf8'),sandbox,{filename:'gps-coordinates.js'});
const parser=sandbox.window.DistrictFlatwaterCoordinates.parse;
assert.equal(parser('38.8895','-77.0353').latitude,38.8895);
assert.equal(parser('38.8895','-77.0353').longitude,-77.0353);
assert.equal(parser('0','0').latitude,0);
assert.equal(parser('90','180').longitude,180);
assert.equal(parser('-90','-180').latitude,-90);
for(const [lat,lon] of [['','-77'],['20',''],['91','0'],['0','181'],['-91','0'],['1','-181'],['1.2.3','4'],['Infinity','2'],['NaN','2'],['41,2','-73'],['1e3','12']]){
 assert.throws(()=>parser(lat,lon));
}
console.log('Manual GPS coordinate validation checks passed');
