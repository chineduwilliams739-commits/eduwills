'use client';
import {useRef,useState} from 'react';
import {ImagePlus,Loader2,RefreshCw} from 'lucide-react';
import {getDownloadURL,ref,uploadBytes} from 'firebase/storage';
import {auth,storage} from '@/lib/firebase';

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
  let finished=false;
  const timer=setTimeout(()=>{if(!finished)reject(Object.assign(new Error('IMAGE_UPLOAD_TIMEOUT'),{code:'storage/retry-limit-exceeded'}))},45000);
  onProgress(12);
  uploadBytes(storageRef,file,{contentType:file.type,customMetadata:{source:'device'}}).then(()=>{finished=true;clearTimeout(timer);onProgress(96);resolve()}).catch(error=>{finished=true;clearTimeout(timer);reject(error)});
 });
}

export default function DeviceImageUpload({path,onUploaded,label='Upload image',uid}:{path:string;onUploaded:(url:string)=>void;label?:string;uid:string}){
 const inputRef=useRef<HTMLInputElement>(null);const[busy,setBusy]=useState(false);const[progress,setProgress]=useState(0);const[message,setMessage]=useState('');
 async function choose(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');
  if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return}
  if(file.size>15*1024*1024){setMessage('Image must be smaller than 15 MB.');return}
  const current=auth.currentUser;
  if(!current||current.uid!==uid){setMessage('Your session is no longer active. Please sign in again.');return}
  try{await current.reload()}catch{}
  if(!auth.currentUser){setMessage('Your session expired. Please sign in again.');return}
  setBusy(true);setProgress(5);setMessage('Preparing secure upload…');setMessage('Preparing secure upload…');setMessage('Preparing secure upload…');setMessage('Preparing secure upload…');
  try{
   setMessage('Preparing image…');const optimized=await compressImage(file);setProgress(10);
   if(optimized.size>7*1024*1024)throw new Error('This image is still too large. Please choose a smaller image.');
   const safeName=optimized.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-60)||'image.webp';
   const storagePath=path==='users'?`users/${uid}/profile/${Date.now()}_${safeName}`:`${path}/${uid}/${Date.now()}_${safeName}`;
   const storageRef=ref(storage,storagePath);setMessage('Uploading securely…');
   let uploaded=false,lastError:any=null;
   for(let attempt=1;attempt<=3&&!uploaded;attempt++){
    try{await uploadFile(storageRef,optimized,setProgress);uploaded=true}catch(error:any){lastError=error;const code=String(error?.code||'');if(code!=='storage/retry-limit-exceeded'||attempt===3)throw error;setMessage('Connection interrupted. Retrying upload…');await new Promise(r=>setTimeout(r,800));}
   }
   if(!uploaded)throw lastError||new Error('Image upload failed.');
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
  {!busy&&message&&/failed|again|expired|authorized|large|too large|connection|session/i.test(message)&&<button type="button" onClick={()=>inputRef.current?.click()} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-black text-cyan-700"><RefreshCw size={13}/> Try another image</button>}
 </div>;
}
