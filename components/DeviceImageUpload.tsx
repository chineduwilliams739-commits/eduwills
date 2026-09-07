'use client';
import {useRef,useState} from 'react';
import {ImagePlus,Loader2} from 'lucide-react';
import {getDownloadURL,ref,setMaxOperationRetryTime,setMaxUploadRetryTime,uploadBytesResumable} from 'firebase/storage';
import {storage} from '@/lib/firebase';

// Keep device images small enough to upload quickly, especially on mobile data.
async function compressImage(file:File){
 if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');
 if(file.type==='image/gif'||file.type==='image/svg+xml')return file;
 // Small images do not need an expensive decode/re-encode cycle.
 if(file.size<=512*1024)return file;
 const bitmap=await createImageBitmap(file);
 const max=768;
 const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable on this device.');
 ctx.drawImage(bitmap,0,0,w,h);bitmap.close();
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.55));
 if(!blob||blob.size>=file.size)return file;
 return new File([blob],'image.webp',{type:'image/webp',lastModified:Date.now()});
}

export default function DeviceImageUpload({path,onUploaded,label='Upload image',uid}:{path:string;onUploaded:(url:string)=>void;label?:string;uid:string}){
 const inputRef=useRef<HTMLInputElement>(null);const[busy,setBusy]=useState(false);const[progress,setProgress]=useState(0);const[message,setMessage]=useState('');
 async function choose(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');if(file.size>12*1024*1024){setMessage('Image must be smaller than 12 MB.');return}setBusy(true);setProgress(2);try{
  const optimized=await compressImage(file);setProgress(12);
  if(optimized.size>2*1024*1024)throw new Error('Please choose a smaller image (2 MB maximum after compression).');
  const safeName=optimized.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-60)||'image.webp';
  const storageRef=ref(storage,`${path}/${uid}/${Date.now()}_${safeName}`);
  // Firebase Storage can otherwise retry a stalled mobile upload for a long time.
  // Bound retries so a dead/stalled connection fails visibly instead of freezing at 12%.
  setMaxUploadRetryTime(storage,30000);
  setMaxOperationRetryTime(storage,30000);
  const task=uploadBytesResumable(storageRef,optimized,{contentType:optimized.type,customMetadata:{uploadedBy:uid,source:'device'}});
  const url=await new Promise<string>((resolve,reject)=>{
   let settled=false;
   const finish=(fn:(value:any)=>void,value:any)=>{if(settled)return;settled=true;fn(value)};
   const timeout=window.setTimeout(()=>{task.cancel();finish(reject,new Error('Image upload timed out. Please check your connection and try again.'))},45000);
   task.on('state_changed',s=>{
    if(s.totalBytes>0)setProgress(12+Math.round(s.bytesTransferred/s.totalBytes*82));
   },err=>{window.clearTimeout(timeout);finish(reject,new Error(err?.code==='storage/unauthorized'?'You are not authorized to upload this image.':err?.message||'Image upload failed. Please try again.'))},async()=>{
    window.clearTimeout(timeout);
    try{finish(resolve,await getDownloadURL(storageRef));}catch(e){finish(reject,e)}
   });
  });
  setProgress(100);onUploaded(url);setMessage('Image ready.');
 }catch(e:any){setMessage(e?.message||'Image upload failed. Please try again.')}finally{setBusy(false)}}
 return <div><input ref={inputRef} type="file" accept="image/*" onChange={choose} className="hidden"/><button type="button" onClick={()=>inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<ImagePlus size={16}/>} {busy?`Uploading ${progress}%`:label}</button>{busy&&<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600 transition-all" style={{width:`${progress}%`}}/></div>}{message&&<p className="mt-2 text-[11px] font-bold text-slate-500">{message}</p>}</div>;
}
