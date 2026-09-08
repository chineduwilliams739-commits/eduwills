import fs from 'node:fs';

const backend = 'workers/payments/src/index.js';
let source = fs.readFileSync(backend, 'utf8');

// Store category arrays as real Firestore arrayValue fields instead of JSON strings.
const oldFsVal = "const fsVal=v=>typeof v==='string'?{stringValue:v}:typeof v==='number'?{doubleValue:v}:{booleanValue:v};";
const newFsVal = "const fsVal=v=>{if(Array.isArray(v))return{arrayValue:{values:v.map(x=>fsVal(x))}};if(v===null||v===undefined)return{nullValue:'NULL_VALUE'};if(typeof v==='string')return{stringValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='boolean')return{booleanValue:v};return{stringValue:String(v)}};";
if (source.includes(oldFsVal)) source = source.replace(oldFsVal, newFsVal);
source = source.replaceAll('categories:JSON.stringify(categories)', 'categories:categories');
source = source.replaceAll('activeCategories:JSON.stringify(categories)', 'activeCategories:categories');
source = source.replaceAll('pendingActivationCategories:JSON.stringify(categories)', 'pendingActivationCategories:categories');

// Make the first category selected at payment time the immediately active dashboard space.
const activationFields = "activationStatus:'active',williTokenActive:true,activationExpiresAt:activationExpiry,categories:categories,activeCategories:categories,pendingActivationCode:''";
const activationFieldsWithCategory = "activationStatus:'active',williTokenActive:true,activationExpiresAt:activationExpiry,categories:categories,activeCategories:categories,activeCategory:categories[0]||'',activeCategoryId:categories[0]||'',pendingActivationCode:''";
source = source.replaceAll(activationFields, activationFieldsWithCategory);

fs.writeFileSync(backend, source);

const upload = 'components/DeviceImageUpload.tsx';
let u = fs.readFileSync(upload, 'utf8');
// Avoid a resumable upload remaining visually parked at the initial 5% state on mobile.
u = u.replace("import {getDownloadURL,ref,uploadBytesResumable} from 'firebase/storage';", "import {getDownloadURL,ref,uploadBytes} from 'firebase/storage';");
const start = u.indexOf('function uploadFile(');
const end = u.indexOf('\n}\n\nexport default function DeviceImageUpload', start);
if (start >= 0 && end > start) {
  u = u.slice(0, start) + `function uploadFile(storageRef:ReturnType<typeof ref>,file:File,onProgress:(value:number)=>void){\n return new Promise<void>((resolve,reject)=>{\n  let finished=false;\n  const timer=setTimeout(()=>{if(!finished)reject(Object.assign(new Error('IMAGE_UPLOAD_TIMEOUT'),{code:'storage/retry-limit-exceeded'}))},45000);\n  onProgress(12);\n  uploadBytes(storageRef,file,{contentType:file.type,customMetadata:{source:'device'}}).then(()=>{finished=true;clearTimeout(timer);onProgress(96);resolve()}).catch(error=>{finished=true;clearTimeout(timer);reject(error)});\n });\n}` + u.slice(end + 2);
}
u = u.replace("let uploaded=false,lastError:any=null;\n   for(let attempt=1;attempt<=2&&!uploaded;attempt++)", "let uploaded=false,lastError:any=null;\n   for(let attempt=1;attempt<=3&&!uploaded;attempt++)");
u = u.replace("code!=='storage/retry-limit-exceeded'||attempt===2", "code!=='storage/retry-limit-exceeded'||attempt===3");
u = u.replace("setBusy(true);setProgress(5);", "setBusy(true);setProgress(5);setMessage('Preparing secure upload…');");
fs.writeFileSync(upload, u);

// Ensure the activation page assigns the redeemed category immediately in the browser too.
const activation = 'app/dashboard/activation/page.tsx';
let a = fs.readFileSync(activation, 'utf8');
const marker = "const result=await redeemThroughBackend(current,clean);setCode('');";
if (a.includes(marker) && !a.includes('eduwills_active_category')) {
  a = a.replace(marker, "const result=await redeemThroughBackend(current,clean);const redeemedCategories=Array.isArray(result.categories)?result.categories:[];const immediateCategory=redeemedCategories[0]||'';if(immediateCategory){sessionStorage.setItem('eduwills_active_category',immediateCategory.toLowerCase().replace(/\\s+/g,'-'));localStorage.setItem('eduwills_active_category',immediateCategory.toLowerCase().replace(/\\s+/g,'-'));}setCode('');");
}
fs.writeFileSync(activation, a);

console.log('Category assignment, Book Learner routing state, and image upload reliability repair applied.');
