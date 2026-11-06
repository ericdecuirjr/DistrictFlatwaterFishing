import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context={window:{},Uint8Array,DataView,ArrayBuffer,Blob,Date,Number,String,Error,Math,console};
vm.runInNewContext(readFileSync('photo-metadata.js','utf8'),context,{filename:'photo-metadata.js'});
const reader=context.window.DistrictFlatwaterPhotoMetadata;
const asFile=exif=>{
  const blob=new Blob([Uint8Array.from([255,216,255,217])],{type:'image/jpeg'});
  blob.nativeExif=exif;
  return blob;
};
const round=number=>Math.round(number*1e6)/1e6;
const expectedLat=38+50/60+30/3600;
const expectedLon=-(76+30/60);

for(const exif of [
  {GPSLatitude:['38/1','50/1','30/1'],GPSLatitudeRef:'N',
   GPSLongitude:['76/1','30/1','0/1'],GPSLongitudeRef:'W',
   DateTimeOriginal:'2026:11:05 12:34:56'},
  {GPS:{Latitude:['38/1','50/1','30/1'],LatitudeRef:'N',
   Longitude:['76/1','30/1','0/1'],LongitudeRef:'W'}},
  JSON.stringify({GPSLatitude:'38/1, 50/1, 30/1',GPSLatitudeRef:'N',
   GPSLongitude:'76/1, 30/1, 0/1',GPSLongitudeRef:'W'}),
  {latitude:expectedLat,longitude:expectedLon}
]){
  const result=await reader.read(asFile(exif));
  assert.equal(round(result.latitude),round(expectedLat));
  assert.equal(round(result.longitude),round(expectedLon));
}
const missing=await reader.read(asFile({DateTimeOriginal:'2026:11:05 12:34:56'}));
assert.equal(missing.latitude,null);
assert.equal(missing.longitude,null);
assert.match(missing.reason,/Android|location/);
const partial=await reader.read(asFile({latitude:38.8,GPSLongitude:'76/1, 30/1, 0/1',GPSLongitudeRef:'W'}));
assert.equal(partial.latitude,null);
assert.equal(partial.longitude,null);
const invalid=await reader.read(asFile({
  GPSLatitude:['91/1','0/1','0/1'],GPSLatitudeRef:'N',
  GPSLongitude:['76/1','0/1','0/1'],GPSLongitudeRef:'W'
}));
assert.equal(invalid.latitude,null);
assert.equal(invalid.longitude,null);
console.log('Samsung/Android EXIF GPS compatibility checks passed');
