'use client';
import {useRef,useState} from 'react';
import {ImagePlus,Loader2,RefreshCw} from 'lucide-react';
import {getDownloadURL,ref,uploadBytesResumable} from 'firebase/storage';
import {storage} from '@/lib/firebase';

async function compressImage(file:File){
 if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');
 if(file.type==='image/gif'||file.type==='image/svg+xml')return file;
 if(file.size<=512*1024)return file;
 const bitmap=await createImageBitmap(file);const max=1280;const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('Image processing is unavailable on this device.');ctx.drawImage(bitmap,0,0,w,h);bitmap.close();
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.7));
 if(!blob||blob.size>=file.size)return file;
 return new File([blob],'image.webp',{type:'image/webp',lastModified:Date.now()});
}

function uploadFile(storageRef:ReturnType<typeof ref>,file:File,onProgress:(value:number)=>void){
 return new Promise<void>((resolve,reject)=>{
  const task=uploadBytesResumable(storageRef,file,{contentType:file.type,customMetadata:{source:'device'}});
  const unsubscribe=task.on('state_changed',snapshot=>{
   const value=snapshot.totalBytes?Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100):0;
   onProgress(value);
  },error=>{unsubscribe();reject(error)},()=>{unsubscribe();resolve()});
 });
}

export default function DeviceImageUpload({path,onUploaded,label='Upload image',uid}:{path:string;onUploaded:(url:string)=>void;label?:string;uid:string}){
 const inputRef=useRef<HTMLInputElement>(null);const[busy,setBusy]=useState(false);const[progress,setProgress]=useState(0);const[message,setMessage]=useState('');
 async function choose(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');
  if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return}
  if(file.size>15*1024*1024){setMessage('Image must be smaller than 15 MB.');return}
  setBusy(true);setProgress(3);
  try{
   setMessage('Preparing image…');const optimized=await compressImage(file);setProgress(10);
   if(optimized.size>7*1024*1024)throw new Error('This image is still too large. Please choose a smaller image.');
   const safeName=optimized.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-60)||'image.webp';
   const storagePath=path==='users'?`users/${uid}/profile/${Date.now()}_${safeName}`:`${path}/${uid}/${Date.now()}_${safeName}`;
   const storageRef=ref(storage,storagePath);setMessage('Uploading securely…');
   await uploadFile(storageRef,optimized,setProgress);
   setProgress(96);setMessage('Finalizing image…');const url=await getDownloadURL(storageRef);
   setProgress(100);onUploaded(url);setMessage('Image uploaded successfully.');
  }catch(e:any){
   const code=String(e?.code||'');
   const detail=code==='storage/unauthorized'?'You are not authorized to upload this image.':code==='storage/unauthenticated'?'Your session expired. Please sign in again.':code==='storage/canceled'?'Upload canceled. Please try again.':code==='storage/retry-limit-exceeded'?'The connection kept failing. Please try again on a stronger connection.':e?.message||'Image upload failed. Please try again.';
   setMessage(detail);
  }finally{setBusy(false)}
 }
 return <div>
  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={choose} className="hidden"/>
  <button type="button" onClick={()=>inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<ImagePlus size={16}/>} {busy?`Uploading ${progress}%`:label}</button>
  {busy&&<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-label={`Upload progress ${progress}%`}><div className="h-full rounded-full bg-cyan-600 transition-[width] duration-200" style={{width:`${progress}%`}}/></div>}
  {message&&<p className="mt-2 text-[11px] font-bold text-slate-500">{message}</p>}
  {!busy&&message&&/failed|again|expired|authorized|large|too large|connection/i.test(message)&&<button type="button" onClick={()=>inputRef.current?.click()} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-black text-cyan-700"><RefreshCw size={13}/> Try another image</button>}
 </div>;
}
