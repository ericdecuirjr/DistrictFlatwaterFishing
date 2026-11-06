/* Native APIs for the Android APK. No changes to IndexedDB record format. */
import {Capacitor,registerPlugin} from '@capacitor/core';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Geolocation} from '@capacitor/geolocation';
import {Camera,MediaTypeSelection} from '@capacitor/camera';

if(Capacitor.isNativePlatform()){
  const meaningfulError=e=>e?.message||e?.code||String(e);
  window.DistrictFlatwaterNative={
    isNative:true,
    // Uses the system picker with an explicit request to share photo GPS.
    // Android may still redact it if the user declines or the device lacks support.
    async pickPhoto(source){
      const OriginalPhoto = registerPlugin('DistrictPhotoImport');
      const fromResult=async result=>{
        const path=result.fileUri?Capacitor.convertFileSrc(result.fileUri):result.webPath;
        if(!path)throw Error('Photo picker returned no readable image.');
        const res=await fetch(path);
        if(!res.ok)throw Error('Could not read selected photograph (HTTP '+res.status+').');
        const blob=await res.blob();
        if(!blob.size)throw Error('Selected photograph is empty.');
        if(blob.size>35*1024*1024)throw Error('That image is too large (35 MB maximum).');
        const format=String(result.metadata?.format||'').toLowerCase();
        const mime=result.mimeType||(format==='png'?'image/png':format==='heic'||format==='heif'?'image/heic':'image/jpeg');
        const ext=mime==='image/png'?'png':mime==='image/heic'?'heic':'jpg';
        const file=new File([blob], 'catch-photo.'+ext,{type:mime});
        // Capacitor 8.1+ returns metadata.exif (often JSON text). Keep it
        // separate from the bytes, which may have been re-encoded.
        const exif=result.nativeExif||result.metadata?.exif||result.exif;
        if(exif)file.nativeExif=exif;
        return file;
      };
      if(source==='camera'){
        return fromResult(await Camera.takePhoto({
          quality:100,includeMetadata:true,correctOrientation:true,
          editable:'no',saveToGallery:false
        }));
      }
      let nativeResult;
      try{
        nativeResult=await OriginalPhoto.pickOriginal({documents:false});
      }catch(e){
        const message=String(e?.message||e);
        // Older builds without this local plugin can still select photos.
        if(!/not implemented|not registered|plugin.*unavailable/i.test(message))throw e;
      }
      if(nativeResult){
        try{return await fromResult(nativeResult);}
        finally{
          await OriginalPhoto.discardTemporary({fileUri:nativeResult.fileUri}).catch(()=>{});
        }
      }
      const gallery=await Camera.chooseFromGallery({
        mediaType:MediaTypeSelection.Photo,allowMultipleSelection:false,
        includeMetadata:true,editable:'no',quality:100
      });
      if(!gallery.results?.[0])throw Error('No photo was selected.');
      return fromResult(gallery.results[0]);
    },
    async pickOriginalFile(){
      const OriginalPhoto=registerPlugin('DistrictPhotoImport');
      const result=await OriginalPhoto.pickOriginal({documents:true});
      try{
        const path=Capacitor.convertFileSrc(result.fileUri);
        const response=await fetch(path);
        if(!response.ok)throw Error('Could not read the original file.');
        const blob=await response.blob();
        if(!blob.size||blob.size>35*1024*1024)throw Error('Original photo is empty or exceeds 35 MB.');
        const mime=result.mimeType||'image/jpeg';
        const file=new File([blob],'original-catch-photo',{type:mime});
        if(result.nativeExif)file.nativeExif=result.nativeExif;
        return file;
      }finally{
        await OriginalPhoto.discardTemporary({fileUri:result.fileUri}).catch(()=>{});
      }
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
