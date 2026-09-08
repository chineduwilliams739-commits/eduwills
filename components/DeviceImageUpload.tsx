'use client';

import {useRef,useState} from 'react';
import {ImagePlus,Loader2,RefreshCw} from 'lucide-react';
import {getDownloadURL,ref,uploadBytes,uploadBytesResumable} from 'firebase/storage';
import {auth,storage} from '@/lib/firebase';

const MAX_INPUT_BYTES=15*1024*1024;
const MAX_UPLOAD_BYTES=7*1024*1024;

function loadImage(file:File):Promise<HTMLImageElement>{
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('IMAGE_DECODE_FAILED'))};
  img.src=url;
 });
}

async function compressImage(file:File){
 if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');
 if(file.type==='image/gif'||file.type==='image/svg+xml')return file;
 if(file.size<=256*1024)return file;
 let width=0,height=0;
 try{
  if(typeof createImageBitmap==='function'){
   const bitmap=await createImageBitmap(file);width=bitmap.width;height=bitmap.height;
   const max=1280,scale=Math.min(1,max/Math.max(width,height));
   const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
   if(!ctx)throw new Error('IMAGE_PROCESSING_UNAVAILABLE');ctx.drawImage(bitmap,0,0,w,h);bitmap.close();
   const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/webp',.78));
   if(blob&&blob.size<file.size)return new File([blob],'image.webp',{type:'image/webp',lastModified:Date.now()});
  }
 }catch{}
 try{
  const img=await loadImage(file);width=img.naturalWidth;height=img.naturalHeight;
  const max=1280,scale=Math.min(1,max/Math.max(width,height));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('IMAGE_PROCESSING_UNAVAILABLE');ctx.drawImage(img,0,0,w,h);
  const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',.78));
  if(blob&&blob.size<file.size)return new File([blob],'image.jpg',{type:'image/jpeg',lastModified:Date.now()});
 }catch{}
 return file;
}

function resumableUpload(storageRef:ReturnType<typeof ref>,file:File,onProgress:(n:number)=>void){
 return new Promise<void>((resolve,reject)=>{
  let done=false,lastBytes=0,lastChange=Date.now();let task:any;
  const finish=(fn:()=>void)=>{if(done)return;done=true;clearInterval(stall);clearTimeout(hard);fn()};
  const stall=setInterval(()=>{if(done)return;if(task?.snapshot?.bytesTransferred!==lastBytes){lastBytes=task.snapshot.bytesTransferred;lastChange=Date.now()}if(Date.now()-lastChange>12000){try{task.cancel()}catch{};finish(()=>reject(Object.assign(new Error('IMAGE_UPLOAD_STALLED'),{code:'storage/retry-limit-exceeded'}))) }},1000);
  const hard=setTimeout(()=>{try{task.cancel()}catch{};finish(()=>reject(Object.assign(new Error('IMAGE_UPLOAD_TIMEOUT'),{code:'storage/retry-limit-exceeded'})))},45000);
  try{
   task=uploadBytesResumable(storageRef,file,{contentType:file.type,cacheControl:'public,max-age=31536000'});
   task.on('state_changed',(snap:any)=>{if(done)return;lastBytes=snap.bytesTransferred;lastChange=Date.now();onProgress(Math.min(92,Math.max(3,Math.round(snap.bytesTransferred/snap.totalBytes*92))))},(error:any)=>finish(()=>reject(error)),()=>finish(()=>{onProgress(95);resolve()}));
  }catch(error){finish(()=>reject(error));}
 });
}

async function uploadWithFallback(storageRef:ReturnType<typeof ref>,file:File,onProgress:(n:number)=>void){
 try{await resumableUpload(storageRef,file,onProgress);return}
 catch(first:any){
  onProgress(8);
  await new Promise(r=>setTimeout(r,500));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),45000);
  try{await uploadBytes(storageRef,file,{contentType:file.type,cacheControl:'public,max-age=31536000'});onProgress(96)}catch(second:any){second.__firstCode=first?.code;throw second}finally{clearTimeout(timer);controller.abort()}
 }
}

export default function DeviceImageUpload({path,onUploaded,label='Upload image',uid}:{path:string;onUploaded:(url:string)=>void;label?:string;uid:string}){
 const inputRef=useRef<HTMLInputElement>(null);const[busy,setBusy]=useState(false);const[progress,setProgress]=useState(0);const[message,setMessage]=useState('');
 async function choose(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');
  if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return}
  if(file.size>MAX_INPUT_BYTES){setMessage('Image must be smaller than 15 MB.');return}
  const current=auth.currentUser;
  if(!current||current.uid!==uid){setMessage('Your session is no longer active. Please sign in again.');return}
  setBusy(true);setProgress(1);setMessage('Preparing image…');
  try{
   const optimized=await compressImage(file);setProgress(5);
   if(optimized.size>MAX_UPLOAD_BYTES)throw new Error('This image is still too large. Please choose a smaller image.');
   const safeName=(optimized.name||'image.jpg').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-60)||'image.jpg';
   const storagePath=path==='users'?`users/${uid}/profile/${Date.now()}_${safeName}`:`${path}/${uid}/${Date.now()}_${safeName}`;
   const storageRef=ref(storage,storagePath);setMessage('Uploading image…');
   let lastError:any=null;
   for(let attempt=1;attempt<=3;attempt++){
    try{await uploadWithFallback(storageRef,optimized,setProgress);lastError=null;break}catch(error:any){lastError=error;if(attempt<3){setMessage(`Upload interrupted. Retrying (${attempt}/3)…`);await new Promise(r=>setTimeout(r,700*attempt));}}
   }
   if(lastError)throw lastError;
   setMessage('Finalizing image…');const url=await getDownloadURL(storageRef);setProgress(100);onUploaded(url);setMessage('Image uploaded successfully.');
  }catch(e:any){
   const code=String(e?.code||e?.__firstCode||'');
   const detail=code==='storage/unauthorized'?'Firebase denied this image upload.':code==='storage/unauthenticated'?'Your session expired. Please sign in again.':code==='storage/canceled'?'Upload canceled. Please try again.':code==='storage/retry-limit-exceeded'?'The upload connection failed repeatedly. Please try again.':e?.message==='This image is still too large. Please choose a smaller image.'?e.message:'Image upload failed. Please try again.';
   setMessage(detail);setProgress(0);
  }finally{setBusy(false)}
 }
 return <div className="w-full">
  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" capture="environment" onChange={choose} className="hidden"/>
  <button type="button" onClick={()=>inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<ImagePlus size={16}/>} {busy?`Uploading ${progress}%`:label}</button>
  {busy&&<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-label={`Upload progress ${progress}%`}><div className="h-full rounded-full bg-cyan-600 transition-[width] duration-200" style={{width:`${progress}%`}}/></div>}
  {message&&<p className={`mt-2 text-[11px] font-bold ${/successfully/i.test(message)?'text-emerald-600':'text-slate-500'}`}>{message}</p>}
  {!busy&&message&&/failed|again|expired|authorized|large|too large|connection|denied/i.test(message)&&<button type="button" onClick={()=>inputRef.current?.click()} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-black text-cyan-700"><RefreshCw size={13}/> Try another image</button>}
 </div>;
}
