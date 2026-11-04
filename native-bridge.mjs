/* Native APIs for the Android APK. No changes to IndexedDB record format. */
import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Geolocation} from '@capacitor/geolocation';
import {Camera,CameraSource,CameraResultType} from '@capacitor/camera';

if(Capacitor.isNativePlatform()){
  const meaningfulError=e=>e?.message||e?.code||String(e);
  window.DistrictFlatwaterNative={
    isNative:true,
    async pickPhoto(source){
      const photo=await Camera.getPhoto({
        source:source==='camera'?CameraSource.Camera:CameraSource.Photos,
        resultType:CameraResultType.Uri,
        quality:86,
        width:1600,
        correctOrientation:true,
        allowEditing:false,
        saveToGallery:false
      });
      if(!photo?.webPath)throw Error('Photo picker returned no readable image.');
      const res=await fetch(photo.webPath);
      if(!res.ok)throw Error('Could not read selected photograph (HTTP '+res.status+').');
      const blob=await res.blob();
      if(!blob.size)throw Error('Selected photograph is empty.');
      const mime=blob.type||'image/jpeg';
      return new File([blob], 'catch-photo.'+(mime==='image/png'?'png':'jpg'),{type:mime});
    },
    async getPosition(){
      const status=await Geolocation.checkPermissions();
      if(status.location!=='granted'&&status.coarseLocation!=='granted'){
        const permission=await Geolocation.requestPermissions();
        if(permission.location!=='granted'&&permission.coarseLocation!=='granted'){
          throw Error('Location permission denied. Enable location for District Flatwater Fishing in Android Settings.');
        }
      }
      return await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:20000,maximumAge:0,enableLocationFallback:true});
    }
  };

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
            const db=r.result,tx=db.transaction('catches','readonly'),q=tx.objectStore('catches').getAll();
            q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
            tx.oncomplete=()=>db.close();
          };
        });
        const base64=blob=>new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(String(reader.result).split(',')[1]);
          reader.onerror=()=>reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const rows=[];
        for(const c of catches){
          const {photo,...details}=c;
          if(!(photo instanceof Blob))throw Error('Catch photo missing from local backup');
          rows.push({...details,photoDataUrl:'data:'+(photo.type||'image/jpeg')+';base64,'+await base64(photo)});
        }
        const archive={application:'district-flatwater-fishing',formatVersion:1,exportedAt:new Date().toISOString(),catches:rows};
        const file='district-flatwater-backup-'+new Date().toISOString().slice(0,10)+'.json';
        const data=await base64(new Blob([JSON.stringify(archive)],{type:'application/json'}));
        const saved=await Filesystem.writeFile({path:file,data,directory:Directory.Cache,recursive:true});
        await Share.share({title:'District Flatwater Fishing backup',url:saved.uri,dialogTitle:'Save a copy of your catch backup'});
      }catch(e){alert('Export failed: '+meaningfulError(e));}
      finally{btn.disabled=false;}
    },true);
  });
}
