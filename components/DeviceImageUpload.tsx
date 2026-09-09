'use client';

import {useRef,useState} from 'react';
import {ImagePlus,Loader2,RefreshCw} from 'lucide-react';

const MAX_INPUT_BYTES=15*1024*1024;
const MAX_UPLOAD_BYTES=7*1024*1024;
const CLOUDINARY_CLOUD_NAME=process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME||'';
const CLOUDINARY_UPLOAD_PRESET=process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET||'';

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
 try{
  if(typeof createImageBitmap==='function'){
   const bitmap=await createImageBitmap(file);const max=1280,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
   const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
   if(!ctx)throw new Error('IMAGE_PROCESSING_UNAVAILABLE');ctx.drawImage(bitmap,0,0,w,h);bitmap.close();
   const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/webp',.78));
   if(blob&&blob.size<file.size)return new File([blob],'image.webp',{type:'image/webp',lastModified:Date.now()});
  }
 }catch{}
 try{
  const img=await loadImage(file);const max=1280,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('IMAGE_PROCESSING_UNAVAILABLE');ctx.drawImage(img,0,0,w,h);
  const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',.78));
  if(blob&&blob.size<file.size)return new File([blob],'image.jpg',{type:'image/jpeg',lastModified:Date.now()});
 }catch{}
 return file;
}

function cloudinaryFolder(path:string,uid:string){
 const clean=path.replace(/^\/+|\/+$/g,'').replace(/[^a-zA-Z0-9/_-]/g,'_');
 return `eduwills/${clean||'uploads'}/${uid}`;
}

function uploadToCloudinary(file:File,path:string,uid:string,onProgress:(n:number)=>void){
 return new Promise<string>((resolve,reject)=>{
  if(!CLOUDINARY_CLOUD_NAME||!CLOUDINARY_UPLOAD_PRESET){
   reject(new Error('CLOUDINARY_NOT_CONFIGURED'));return;
  }
  const endpoint=`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/upload`;
  const form=new FormData();form.append('file',file);form.append('upload_preset',CLOUDINARY_UPLOAD_PRESET);form.append('folder',cloudinaryFolder(path,uid));
  const xhr=new XMLHttpRequest();let settled=false;
  const timer=setTimeout(()=>{if(!settled){settled=true;xhr.abort();reject(new Error('CLOUDINARY_UPLOAD_TIMEOUT'))}},90000);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(96,Math.max(5,Math.round(e.loaded/e.total*96))));};
  xhr.onerror=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(new Error('CLOUDINARY_NETWORK_ERROR'))};
  xhr.onabort=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(new Error('CLOUDINARY_UPLOAD_ABORTED'))};
  xhr.onreadystatechange=()=>{
   if(xhr.readyState!==4||settled)return;
   clearTimeout(timer);settled=true;
   if(xhr.status>=200&&xhr.status<300){
    try{const data=JSON.parse(xhr.responseText);if(!data.secure_url)throw new Error('CLOUDINARY_NO_URL');onProgress(100);resolve(data.secure_url)}catch{reject(new Error('CLOUDINARY_INVALID_RESPONSE'))}
   }else{
    let message='CLOUDINARY_UPLOAD_FAILED';
    try{message=JSON.parse(xhr.responseText)?.error?.message||message}catch{}
    reject(new Error(message));
   }
  };
  try{xhr.open('POST',endpoint);xhr.send(form)}catch(error){clearTimeout(timer);if(!settled){settled=true;reject(error)}}
 });
}

export default function DeviceImageUpload({path,onUploaded,label='Upload image',uid}:{path:string;onUploaded:(url:string)=>void;label?:string;uid:string}){
 const inputRef=useRef<HTMLInputElement>(null);const[busy,setBusy]=useState(false);const[progress,setProgress]=useState(0);const[message,setMessage]=useState('');
 async function choose(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;setMessage('');
  if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return}
  if(file.size>MAX_INPUT_BYTES){setMessage('Image must be smaller than 15 MB.');return}
  setBusy(true);setProgress(1);setMessage('Preparing image…');
  try{
   const optimized=await compressImage(file);setProgress(5);
   if(optimized.size>MAX_UPLOAD_BYTES)throw new Error('This image is still too large. Please choose a smaller image.');
   setMessage('Uploading image…');let lastError:any=null;let url='';
   for(let attempt=1;attempt<=3;attempt++){
    try{url=await uploadToCloudinary(optimized,path,uid,setProgress);lastError=null;break}catch(error:any){lastError=error;if(attempt<3){setMessage(`Upload interrupted. Retrying (${attempt}/3)…`);await new Promise(r=>setTimeout(r,900*attempt));}}
   }
   if(lastError)throw lastError;
   setMessage('Finalizing image…');onUploaded(url);setProgress(100);setMessage('Image uploaded successfully.');
  }catch(e:any){
   const code=String(e?.message||'');
   const detail=code==='CLOUDINARY_NOT_CONFIGURED'?'Image uploads are not configured yet. Please contact the administrator.':code==='CLOUDINARY_UPLOAD_TIMEOUT'?'The upload timed out. Please try again.':code==='CLOUDINARY_NETWORK_ERROR'?'The upload connection failed. Please try again.':code==='CLOUDINARY_UPLOAD_ABORTED'?'Upload canceled. Please try again.':e?.message==='This image is still too large. Please choose a smaller image.'?e.message:'Image upload failed. Please try again.';
   setMessage(detail);setProgress(0);
  }finally{setBusy(false)}
 }
 return <div className="w-full">
  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" onChange={choose} className="hidden"/>
  <button type="button" onClick={()=>inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<ImagePlus size={16}/>} {busy?`Uploading ${progress}%`:label}</button>
  {busy&&<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-label={`Upload progress ${progress}%`}><div className="h-full rounded-full bg-cyan-600 transition-[width] duration-200" style={{width:`${progress}%`}}/></div>}
  {message&&<p className={`mt-2 text-[11px] font-bold ${/successfully/i.test(message)?'text-emerald-600':'text-slate-500'}`}>{message}</p>}
  {!busy&&message&&/failed|again|expired|authorized|large|too large|connection|denied|not configured|timed out/i.test(message)&&<button type="button" onClick={()=>inputRef.current?.click()} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-black text-cyan-700"><RefreshCw size={13}/> Try another image</button>}
 </div>;
}
