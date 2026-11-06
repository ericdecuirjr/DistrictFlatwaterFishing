/* District Flatwater photo metadata v3.2.0.
   Lightweight local EXIF reader (JPEG, PNG eXIf, TIFF); no uploads or network calls.
   Read ORIGINAL file before canvas optimization strips metadata. */
(()=>{
  'use strict';
  function parseExifBytes(bytes){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const len=bytes.length;
    const bounded=(p,n=1)=>Number.isSafeInteger(p)&&p>=0&&p+n<=len;
    const text=(p,n)=>{if(!bounded(p,n))return '';return String.fromCharCode(...bytes.subarray(p,p+Math.min(n,64))).replace(/\0.*$/,'').trim();};
    function tiff(base){
      if(!bounded(base,8))return null;
      const order=text(base,2);
      if(order!=='II'&&order!=='MM')return null;
      const le=order==='II';
      const u16=p=>{if(!bounded(p,2))throw Error('Truncated EXIF');return view.getUint16(p,le);};
      const u32=p=>{if(!bounded(p,4))throw Error('Truncated EXIF');return view.getUint32(p,le);};
      if(u16(base+2)!==42)return null;
      function entries(offset){
        const pos=base+offset;
        if(!bounded(pos,2))return new Map();
        const count=u16(pos);
        if(count>512||!bounded(pos+2,count*12))return new Map();
        const tags=new Map();
        for(let i=0;i<count;i++){
          const entry=pos+2+i*12;
          const tag=u16(entry),type=u16(entry+2),n=u32(entry+4);
          const size=({1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8})[type];
          if(!size||n>1000000||n*size>8*1024*1024)continue;
          const ptr=n*size<=4?entry+8:base+u32(entry+8);
          if(!bounded(ptr,n*size))continue;
          tags.set(tag,{type,n,ptr});
        }
        return tags;
      }
      const getNumber=v=>v&&v.n===1?(v.type===3?u16(v.ptr):v.type===4?u32(v.ptr):null):null;
      const getAscii=v=>v&&v.type===2?text(v.ptr,Math.min(v.n,64)):'';
      const getRationals=v=>{
        if(!v||v.type!==5||v.n!==3)return null;
        const vals=[];
        for(let i=0;i<3;i++){
          const p=v.ptr+i*8,den=u32(p+4);
          if(!den)return null;
          vals.push(u32(p)/den);
        }
        return vals;
      };
      const primary=entries(u32(base+4));
      const exifPtr=getNumber(primary.get(0x8769));
      const gpsPtr=getNumber(primary.get(0x8825));
      const exif=Number.isInteger(exifPtr)?entries(exifPtr):new Map();
      const gps=Number.isInteger(gpsPtr)?entries(gpsPtr):new Map();
      const capturedAt=getAscii(exif.get(0x9003))||getAscii(exif.get(0x9004));
      const offsetTime=getAscii(exif.get(0x9011))||getAscii(exif.get(0x9012));
      function coord(tag,refTag,allowed){
        const parts=getRationals(gps.get(tag));
        const ref=getAscii(gps.get(refTag)).toUpperCase();
        if(!parts||!allowed.includes(ref)||parts.some(x=>!Number.isFinite(x)||x<0))return null;
        const dec=parts[0]+parts[1]/60+parts[2]/3600;
        const val=(ref===allowed[1]?-1:1)*dec;
        return Math.abs(val)<=(tag===2?90:180)?val:null;
      }
      return {capturedAt,offsetTime,latitude:coord(2,1,['N','S']),longitude:coord(4,3,['E','W'])};
    }
    try{
      if(len>=4&&bytes[0]===0xff&&bytes[1]===0xd8){
        for(let p=2;p+4<len;){
          if(bytes[p]!==0xff){p++;continue;}
          while(bytes[p]===0xff)p++;
          const marker=bytes[p++];
          if(marker===0xda||marker===0xd9)break;
          if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
          if(!bounded(p,2))break;
          const segment=(bytes[p]<<8)|bytes[p+1];
          if(segment<2||!bounded(p,segment))break;
          const start=p+2;
          if(marker===0xe1&&text(start,6)==='Exif'){
            const result=tiff(start+6);
            if(result)return result;
          }
          p+=segment;
        }
      }
      if(len>=12&&bytes[0]===137&&text(1,3)==='PNG'){
        for(let p=8;p+12<len;){
          const n=view.getUint32(p,false);
          if(!bounded(p+8,n+4))break;
          if(text(p+4,4)==='eXIf')return tiff(p+8);
          p+=12+n;
        }
      }
      if(len>=8&&((bytes[0]===73&&bytes[1]===73)||(bytes[0]===77&&bytes[1]===77)))return tiff(0);
    }catch(e){return null;}
    return null;
  }
  function normalizedTime(raw,offset){
    if(typeof raw!=='string')return null;
    const m=/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
    if(!m)return null;
    const [y,mo,d,h,mi,s]=m.slice(1).map(Number);
    if(y<1970||y>2100||mo<1||mo>12||h>23||mi>59||s>59)return null;
    const chk=new Date(Date.UTC(y,mo-1,d,h,mi,s));
    if(chk.getUTCFullYear()!==y||chk.getUTCMonth()!==mo-1||chk.getUTCDate()!==d)return null;
    const input=[m[1],m[2],m[3]].join('-')+'T'+m[4]+':'+m[5];
    const zone=typeof offset==='string'&&/^([+-])(?:0\d|1[0-4]):[0-5]\d$/.test(offset.trim())?offset.trim():null;
    const parsed=zone?new Date(input+':'+m[6]+zone):new Date(y,mo-1,d,h,mi,s);
    if(Number.isNaN(parsed.getTime()))return null;
    return {input,iso:parsed.toISOString(),offsetKnown:!!zone};
  }
  function validCoordinate(n,limit){return typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=limit?n:null;}
  async function read(file){
    if(!file||!file.size)return {date:null,latitude:null,longitude:null,reason:'No image was selected'};
    // JPEG/PNG EXIF is generally near the beginning. Capped to avoid loading huge photos twice.
    let exif=null;
    try{
      const bytes=new Uint8Array(await file.slice(0,Math.min(file.size,8*1024*1024)).arrayBuffer());
      exif=parseExifBytes(bytes);
    }catch(e){return {date:null,latitude:null,longitude:null,reason:'Could not read image metadata'};}
    // Native camera metadata is sometimes a JSON string in Capacitor 8.1+.
    // Samsung/Android may provide GPS as fractions (degrees/minutes/seconds),
    // not the pre-decimalized latitude/longitude used by our old fallback.
    let native=null;
    if(file.nativeExif&&typeof file.nativeExif==='object')native=file.nativeExif;
    else if(typeof file.nativeExif==='string'&&file.nativeExif.length<200000){
      try{const parsed=JSON.parse(file.nativeExif);if(parsed&&typeof parsed==='object')native=parsed;}
      catch(_e){/* An unavailable native EXIF blob is not a GPS location. */}
    }
    const gps=native?.GPS||native?.['{GPS}']||native?.gps||native;
    const rational=value=>{
      if(typeof value==='number')return Number.isFinite(value)?value:null;
      if(typeof value!=='string')return null;
      const s=value.trim();
      if(/^[-+]?\\d+(?:\\.\\d+)?$/.test(s))return Number(s);
      const parts=/^([+-]?\\d+(?:\\.\\d+)?)\\s*\\/\\s*(\\d+(?:\\.\\d+)?)$/.exec(s);
      if(!parts||Number(parts[2])===0)return null;
      return Number(parts[1])/Number(parts[2]);
    };
    const dms=value=>{
      if(Array.isArray(value)&&value.length===3){
        const parts=value.map(rational);
        return parts.every(Number.isFinite)&&parts[0]>=0&&parts[1]>=0&&parts[1]<60&&parts[2]>=0&&parts[2]<60?
          parts[0]+parts[1]/60+parts[2]/3600:null;
      }
      if(typeof value==='string'){
        const parts=value.trim().split(/[,;\\s°′'″"]+/).filter(Boolean);
        if(parts.length===3)return dms(parts);
      }
      return null;
    };
    const nativeCoordinate=(name,limit)=>{
      const direct=validCoordinate(native?.[name],limit);
      if(direct!==null)return direct;
      const value=gps?.[name==='latitude'?'GPSLatitude':'GPSLongitude']??
        gps?.[name==='latitude'?'Latitude':'Longitude'];
      const ref=String(gps?.[name==='latitude'?'GPSLatitudeRef':'GPSLongitudeRef']??
        gps?.[name==='latitude'?'LatitudeRef':'LongitudeRef']??'').trim().toUpperCase();
      if(!['N','S','E','W'].includes(ref))return null;
      if(name==='latitude'&&!['N','S'].includes(ref))return null;
      if(name==='longitude'&&!['E','W'].includes(ref))return null;
      const degrees=dms(value)??rational(value);
      if(!Number.isFinite(degrees)||degrees<0||degrees>limit)return null;
      return (ref==='S'||ref==='W'?-1:1)*degrees;
    };
    const rawDate=exif?.capturedAt||native?.DateTimeOriginal||native?.dateTimeOriginal||
      native?.DateTimeDigitized||native?.['Date/Time Original']||'';
    const rawOffset=exif?.offsetTime||native?.OffsetTimeOriginal||
      native?.offsetTimeOriginal||'';
    const date=normalizedTime(rawDate,rawOffset);
    // Coordinates must come from a matching pair in the same source.
    const exifPair=validCoordinate(exif?.latitude,90)!==null&&validCoordinate(exif?.longitude,180)!==null;
    const nativeLatitude=nativeCoordinate('latitude',90);
    const nativeLongitude=nativeCoordinate('longitude',180);
    const nativePair=nativeLatitude!==null&&nativeLongitude!==null;
    const latitude=exifPair?exif.latitude:(nativePair?nativeLatitude:null);
    const longitude=exifPair?exif.longitude:(nativePair?nativeLongitude:null);
    const reason=!nativePair&&!exifPair?
      'Photo GPS unavailable: the image may have no location tags, or Android may have withheld them. Try browsing the original file.':
      '';
    return {date,latitude,longitude,reason};

  }
  window.DistrictFlatwaterPhotoMetadata={read,parseExifBytes,normalizedTime};
})();