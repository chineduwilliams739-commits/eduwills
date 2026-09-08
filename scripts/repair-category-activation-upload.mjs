import fs from 'node:fs';

function replaceOrFail(text, pattern, replacement, label, flags='') {
  const re = new RegExp(pattern, flags);
  if (!re.test(text)) throw new Error(`REPAIR_MATCH_FAILED: ${label}`);
  return text.replace(re, replacement);
}

// Firestore REST must receive arrays as arrayValue, not JSON strings.
const backendPath='workers/payments/src/index.js';
let b=fs.readFileSync(backendPath,'utf8');
if (b.includes("const fsVal=v=>typeof v==='string'?{stringValue:v}:typeof v==='number'?{doubleValue:v}:{booleanValue:v};")) {
  b=b.replace("const fsVal=v=>typeof v==='string'?{stringValue:v}:typeof v==='number'?{doubleValue:v}:{booleanValue:v};", "const fsVal=v=>{if(Array.isArray(v))return{arrayValue:{values:v.map(x=>fsVal(x))}};if(v===null||v===undefined)return{nullValue:'NULL_VALUE'};if(typeof v==='string')return{stringValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='boolean')return{booleanValue:v};return{stringValue:String(v)}};");
}
b=b.replaceAll('categories:JSON.stringify(categories)','categories:categories');
b=b.replaceAll('activeCategories:JSON.stringify(categories)','activeCategories:categories');
b=b.replaceAll('pendingActivationCategories:JSON.stringify(categories)','pendingActivationCategories:categories');
const oldActivation="activationStatus:'active',williTokenActive:true,activationExpiresAt:activationExpiry,categories:categories,activeCategories:categories,pendingActivationCode:''";
const newActivation="activationStatus:'active',williTokenActive:true,activationExpiresAt:activationExpiry,categories:categories,activeCategories:categories,activeCategory:categories[0]||'',activeCategoryId:categories[0]||'',pendingActivationCode:''";
b=b.replaceAll(oldActivation,newActivation);
const oldParse="let categories=[];\ntry{categories=JSON.parse(f.categories?.stringValue||'[]')}catch{categories=[]}";
const newParse="let categories=[];if(Array.isArray(f.categories?.arrayValue?.values)){categories=cleanCategories(f.categories.arrayValue.values.map(v=>v?.stringValue||v?.integerValue||v?.doubleValue||''));}else{try{categories=JSON.parse(f.categories?.stringValue||'[]')}catch{categories=[]}}";
if(b.includes(oldParse)) b=b.replace(oldParse,newParse);
fs.writeFileSync(backendPath,b);

// Do not downgrade the modern uploader. The current component intentionally uses
// direct upload for mobile reliability and resumable upload where appropriate.
const uploadPath='components/DeviceImageUpload.tsx';
let u=fs.readFileSync(uploadPath,'utf8');
if (u.includes('uploadBytesResumable') || u.includes('uploadBytes')) {
  console.log('Modern DeviceImageUpload already present; preserving it.');
} else {
  u=u.replace("import {getDownloadURL,ref} from 'firebase/storage';", "import {getDownloadURL,ref,uploadBytes} from 'firebase/storage';");
  const start=u.indexOf('function uploadFile(');
  const end=u.indexOf('\n}\n\nexport default function DeviceImageUpload',start);
  if(start<0||end<0) throw new Error('REPAIR_MATCH_FAILED: uploadFile function');
  u=u.slice(0,start)+`function uploadFile(storageRef:ReturnType<typeof ref>,file:File,onProgress:(value:number)=>void){\n return new Promise<void>((resolve,reject)=>{\n  let finished=false;\n  const timer=setTimeout(()=>{if(!finished)reject(Object.assign(new Error('IMAGE_UPLOAD_TIMEOUT'),{code:'storage/retry-limit-exceeded'}))},45000);\n  onProgress(12);\n  uploadBytes(storageRef,file,{contentType:file.type,customMetadata:{source:'device'}}).then(()=>{finished=true;clearTimeout(timer);onProgress(96);resolve()}).catch(error=>{finished=true;clearTimeout(timer);reject(error)});\n });\n}`+u.slice(end+2);
  fs.writeFileSync(uploadPath,u);
}

// Persist the category immediately in the browser as a fast UI fallback after redemption.
const activationPath='app/dashboard/activation/page.tsx';
let a=fs.readFileSync(activationPath,'utf8');
const marker="const result=await redeemThroughBackend(current,clean);setCode('');setPaymentSuccess({code:clean";
if(a.includes(marker) && !a.includes('eduwills_active_category')){
  a=a.replace(marker,"const result=await redeemThroughBackend(current,clean);const redeemedCategories=Array.isArray(result.categories)?result.categories:[];const immediateCategory=redeemedCategories[0]||'';if(immediateCategory){sessionStorage.setItem('eduwills_active_category',immediateCategory.toLowerCase().replace(/\\s+/g,'-'));localStorage.setItem('eduwills_active_category',immediateCategory.toLowerCase().replace(/\\s+/g,'-'));}setCode('');setPaymentSuccess({code:clean");
}
fs.writeFileSync(activationPath,a);
console.log('Category activation and mobile image upload repair V3 applied.');
