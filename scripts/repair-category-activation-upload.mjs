import fs from 'node:fs';

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

// Image uploads are now handled by the Cloudinary-based DeviceImageUpload.
// Never run the obsolete Firebase Storage uploader rewrite after the migration.
const uploadPath='components/DeviceImageUpload.tsx';
const u=fs.readFileSync(uploadPath,'utf8');
if (!u.includes('uploadToCloudinary') || !u.includes('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET')) {
  throw new Error('REPAIR_MATCH_FAILED: Cloudinary DeviceImageUpload');
}
console.log('Cloudinary DeviceImageUpload detected; legacy Firebase uploader repair skipped.');

// Persist the category immediately in the browser as a fast UI fallback after redemption.
const activationPath='app/dashboard/activation/page.tsx';
let a=fs.readFileSync(activationPath,'utf8');
const marker="const result=await redeemThroughBackend(current,clean);setCode('');setPaymentSuccess({code:clean";
if(a.includes(marker) && !a.includes('eduwills_active_category')){
  a=a.replace(marker,"const result=await redeemThroughBackend(current,clean);const redeemedCategories=Array.isArray(result.categories)?result.categories:[];const immediateCategory=redeemedCategories[0]||'';if(immediateCategory){sessionStorage.setItem('eduwills_active_category',immediateCategory.toLowerCase().replace(/\\s+/g,'-'));localStorage.setItem('eduwills_active_category',immediateCategory.toLowerCase().replace(/\\s+/g,'-'));}setCode('');setPaymentSuccess({code:clean");
}
fs.writeFileSync(activationPath,a);
console.log('Category activation and Cloudinary image upload repair applied safely.');
