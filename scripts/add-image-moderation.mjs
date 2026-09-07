import fs from 'node:fs';
const pkgPath='functions/package.json';
const fnPath='functions/index.js';
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
pkg.dependencies=pkg.dependencies||{};
pkg.dependencies['@google-cloud/vision']='^5.3.3';
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
let fn=fs.readFileSync(fnPath,'utf8');
if(!fn.includes("firebase-functions/v2/storage")) fn="const { onObjectFinalized } = require('firebase-functions/v2/storage');\nconst vision = require('@google-cloud/vision');\nconst visionClient = new vision.ImageAnnotatorClient();\n"+fn;
if(!fn.includes('exports.moderateUploadedImage')){
const lines=[
"",
"exports.moderateUploadedImage = onObjectFinalized({ region: 'us-central1', memory: '512MiB' }, async (event) => {",
"  const object = event.data || {};",
"  if (!String(object.contentType || '').startsWith('image/')) return;",
"  const bucketName = object.bucket; const name = object.name;",
"  if (!bucketName || !name) return;",
"  try {",
"    const [result] = await visionClient.safeSearchDetection('gs://' + bucketName + '/' + name);",
"    const safe = result?.safeSearchAnnotation || {};",
"    const blocked = ['adult','racy'].some(k => ['LIKELY','VERY_LIKELY'].includes(String(safe[k] || '').toUpperCase()));",
"    if (blocked) { const { getStorage } = require('firebase-admin/storage'); await getStorage().bucket(bucketName).file(name).delete().catch(() => {}); return; }",
"    if (name.startsWith('users/')) { const parts=name.split('/'); const uid=parts[1]; if(uid){ const { getFirestore } = require('firebase-admin/firestore'); await getFirestore().doc('users/'+uid).set({photoModerationStatus:'approved',photoModeratedAt:new Date()},{merge:true}); } }",
"  } catch (e) { console.error('Image moderation failed', e); }",
"});",
""
];
fn+=lines.join('\n');
}
fs.writeFileSync(fnPath,fn);
