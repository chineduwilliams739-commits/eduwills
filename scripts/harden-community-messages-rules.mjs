import fs from 'node:fs';
const p='firestore.rules';let s=fs.readFileSync(p,'utf8');
if(!s.includes('match /communityGroups/{groupId}/messages/{messageId}')){
 const block=`\n      match /communityGroups/{groupId}/messages/{messageId} {\n        allow read: if signedIn() && isGroupMember(groupId);\n        allow create: if signedIn() && isGroupMember(groupId) && request.resource.data.senderId == request.auth.uid;\n        allow update, delete: if signedIn() && (isGroupAdmin(groupId) || resource.data.senderId == request.auth.uid);\n      }\n`;
 const idx=s.lastIndexOf('\n  }\n}');
 if(idx<0) throw new Error('Could not locate firestore rules closing block');
 s=s.slice(0,idx)+block+s.slice(idx);
 fs.writeFileSync(p,s);
}
