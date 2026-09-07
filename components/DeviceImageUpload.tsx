'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export default function DeviceImageUpload({ path, onUploaded, label='Upload image', uid }: { path:string; onUploaded:(url:string)=>void; label?:string; uid:string }) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function choose(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; e.target.value=''; if(!file)return;
    setMessage('');
    if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return;}
    if(file.size>8*1024*1024){setMessage('Image must be smaller than 8 MB.');return;}
    // Client-side guard for obviously unsupported image metadata. Final safety
    // moderation is performed on the server after upload; unsafe media is removed.
    setBusy(true);
    try{
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-80)||'image';
      const storageRef=ref(storage,`${path}/${uid}/${Date.now()}_${safeName}`);
      await uploadBytes(storageRef,file,{contentType:file.type,customMetadata:{uploadedBy:uid,source:'device'}});
      const url=await getDownloadURL(storageRef); onUploaded(url); setMessage('Image uploaded. EDUWILLS will remove media that violates its safety rules.');
    }catch(e:any){setMessage(e?.message||'Image upload failed. Please try again.');}finally{setBusy(false)}
  }
  return <div>
    <input ref={inputRef} type="file" accept="image/*" onChange={choose} className="hidden"/>
    <button type="button" onClick={()=>inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black disabled:opacity-50">
      {busy?<Loader2 size={16} className="animate-spin"/>:<ImagePlus size={16}/>} {busy?'Uploading…':label}
    </button>
    {message&&<p className="mt-2 text-[11px] font-bold text-slate-500">{message}</p>}
  </div>;
}
