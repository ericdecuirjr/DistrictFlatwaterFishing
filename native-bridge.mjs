/* Native helper for sharing catch backups; existing IndexedDB schema stays unchanged. */
import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Geolocation} from '@capacitor/geolocation';
if(Capacitor.isNativePlatform()){
  try{
    const geo=navigator.geolocation;
    if(geo){
      geo.getCurrentPosition=(success,failure,opts)=>{
        Geolocation.getCurrentPosition({enableHighAccuracy:opts?.enableHighAccuracy??true,timeout:opts?.timeout||15000})
          .then(p=>success({coords:p.coords,timestamp:p.timestamp}))
          .catch(e=>failure?.({code:1,message:e?.message||'Location unavailable'}));
      };
    }
  }catch(e){console.warn('Using WebView location API fallback',e);}
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('export-btn');
    if(!btn)return;
    btn.addEventListener('click',async event=>{
      event.stopImmediatePropagation();btn.disabled=true;
      try{
        const catches=await new Promise((resolve,reject)=>{
          const r=indexedDB.open('district-flatwater-catches-v1');
          r.onerror=()=>reject(r.error);
          r.onsuccess=()=>{
            const db=r.result, tx=db.transaction('catches','readonly'), q=tx.objectStore('catches').getAll();
            q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
            tx.oncomplete=()=>db.close();
          };
        });
        const b64=blob=>new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(String(reader.result).split(',')[1]);
          reader.onerror=()=>reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const rows=[];
        for(const c of catches){
          const {photo,...details}=c;
          rows.push({...details,photoDataUrl:'data:'+(photo.type||'image/jpeg')+';base64,'+await b64(photo)});
        }
        const data={application:'district-flatwater-fishing',formatVersion:1,exportedAt:new Date().toISOString(),catches:rows};
        const name='district-flatwater-backup-'+new Date().toISOString().slice(0,10)+'.json';
        const saved=await Filesystem.writeFile({path:name,data:await b64(new Blob([JSON.stringify(data)],{type:'application/json'})),directory:Directory.Cache,recursive:true});
        await Share.share({title:'District Flatwater Fishing backup',url:saved.uri,dialogTitle:'Save or share your catch backup'});
      }catch(e){alert('Export failed: '+(e.message||String(e)));}
      finally{btn.disabled=false;}
    },true);
  });
}
