/* Offline tests for local JPEG EXIF parsing; no fishing records touched. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sandbox={window:{},Uint8Array,DataView,ArrayBuffer,Date,Number,String,Error,Math,console};
vm.runInNewContext(readFileSync('photo-metadata.js','utf8'),sandbox,{filename:'photo-metadata.js'});
const metadata=sandbox.window.DistrictFlatwaterPhotoMetadata;
assert.ok(metadata?.read,'Metadata parser should be installed');

// Synthetic JPEG with DateTimeOriginal, latitude N 38° 50′ 30″,
// longitude W 76° 30′ 0″, written entirely in memory.
function jpegFixture(){
  const t=new Uint8Array(180),v=new DataView(t.buffer);
  t.set([73,73],0);v.setUint16(2,42,true);v.setUint32(4,8,true);
  const u16=(p,x)=>v.setUint16(p,x,true),u32=(p,x)=>v.setUint32(p,x,true);
  const entry=(p,tag,type,count,value)=>{
    u16(p,tag);u16(p+2,type);u32(p+4,count);u32(p+8,value);
  };
  u16(8,2);
  entry(10,0x8769,4,1,38);
  entry(22,0x8825,4,1,56);
  u32(34,0);
  u16(38,1);
  entry(40,0x9003,2,20,110);
  u32(52,0);
  u16(56,4);
  entry(58,1,2,2,78); // EXIF ASCII 'N' in inline value
  entry(70,2,5,3,130);
  entry(82,3,2,2,87); // EXIF ASCII 'W' in inline value
  entry(94,4,5,3,154);
  u32(106,0);
  t.set(new TextEncoder().encode('2026:11:03 18:25:00\0'),110);
  for(const [offset,parts] of [[130,[38,50,30]],[154,[76,30,0]]]){
    parts.forEach((n,i)=>{u32(offset+i*8,n);u32(offset+i*8+4,1);});
  }
  // 0x78 = little-endian ASCII 'x', not correct for N/W inline references.
  t[58+8]='N'.charCodeAt(0);t[58+9]=0;
  t[82+8]='W'.charCodeAt(0);t[82+9]=0;
  const len=t.length+8;
  const jpeg=new Uint8Array(len+6);
  jpeg.set([255,216,255,225,len>>8,len&255,69,120,105,102,0,0],0);
  jpeg.set(t,12);
  jpeg.set([255,217],12+t.length);
  return jpeg;
}
const parsed=metadata.parseExifBytes(jpegFixture());
assert.equal(parsed.capturedAt,'2026:11:03 18:25:00');
assert.ok(Math.abs(parsed.latitude-(38+50/60+30/3600))<1e-7);
assert.ok(Math.abs(parsed.longitude+76.5)<1e-7);
assert.equal(metadata.normalizedTime(parsed.capturedAt,'').input,'2026-11-03T18:25');
assert.equal(metadata.normalizedTime('2026:11:03 18:25:00','-04:00').iso,'2026-11-03T22:25:00.000Z');
assert.equal(metadata.normalizedTime('2026:02:31 18:25:00',''),null);
assert.equal(metadata.parseExifBytes(new Uint8Array([255,216,255,217])),null);
const file=new Blob([jpegFixture()],{type:'image/jpeg'});
const result=await metadata.read(file);
assert.equal(result.date.input,'2026-11-03T18:25');
assert.ok(Math.abs(result.longitude+76.5)<1e-7);
const empty=await metadata.read(new Blob([new Uint8Array([255,216,255,217])],{type:'image/jpeg'}));
assert.equal(empty.date,null);
assert.equal(empty.latitude,null);
assert.equal(empty.longitude,null);
console.log('Photo metadata parsing checks passed');
