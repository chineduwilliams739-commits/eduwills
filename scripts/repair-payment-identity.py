from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(path, replacements):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    original = s
    for old, new in replacements:
        if old in s:
            s = s.replace(old, new, 1)
    if s != original:
        p.write_text(s, encoding='utf-8')
        print(f'Patched {path}')

patch('workers/payments/src/index.js', [
("async function fsWrite(env,path,fields){const t=await googleAccessToken(env);const r=await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,{method:'PATCH',headers:{Authorization:`Bearer ${t}`,'content-type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,fsVal(v)]))})});if(!r.ok)throw new Error('FIRESTORE_WRITE_FAILED');return r.json();}",
 "async function fsWrite(env,path,fields){const t=await googleAccessToken(env);const entries=Object.entries(fields);const mask=entries.map(([k])=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');const r=await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}?${mask}`,{method:'PATCH',headers:{Authorization:`Bearer ${t}`,'content-type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(entries.map(([k,v])=>[k,fsVal(v)]))})});if(!r.ok)throw new Error('FIRESTORE_WRITE_FAILED');return r.json();}"),
("const authEmail=String(authUser?.email||'').trim().toLowerCase();const txEmail=String(tx?.customer?.email||tx?.metadata?.email||'').trim().toLowerCase();const email=String(uf.email?.stringValue||authEmail||txEmail).trim().toLowerCase();const name=String(uf.fullName?.stringValue||uf.displayName?.stringValue||authUser?.displayName||tx?.customer?.first_name||'').trim();const username=String(uf.username?.stringValue||'').trim()||usernameFromEmail(email);",
 "const meta=tx.metadata||{};const authEmail=String(authUser?.email||'').trim().toLowerCase();const txEmail=String(tx?.customer?.email||meta.email||'').trim().toLowerCase();const email=authEmail||txEmail||String(uf.email?.stringValue||'').trim().toLowerCase();const name=String(uf.fullName?.stringValue||uf.displayName?.stringValue||meta.fullName||authUser?.displayName||tx?.customer?.first_name||'').trim();const username=String(uf.username?.stringValue||meta.username||'').trim()||usernameFromEmail(email);"),
("if(!uf.email?.stringValue&&email)identity.email=email;if(!uf.fullName?.stringValue&&name)identity.fullName=name;if(!uf.username?.stringValue&&username)identity.username=username;",
 "if(email&&(!uf.email?.stringValue||uf.email.stringValue!==email))identity.email=email;if(name&&!uf.fullName?.stringValue)identity.fullName=name;if(username&&!uf.username?.stringValue)identity.username=username;"),
("await fsWrite(env,path,{token:code,code,userId:uid,uid,email,categories:JSON.stringify(categories),duration:'1 year',durationMs:31536000000,createdAt:new Date(now).toISOString(),expiresAt:new Date(activationExpires).toISOString(),codeExpiresAt:new Date(codeExpires).toISOString(),used:false,redeemed:false,active:false,source:'paystack',paymentReference,paymentCurrency:currency,paymentAmount:amount,paymentId:Number(tx.id||0),paymentStatus:'success'});",
 "await fsWrite(env,path,{token:code,code,userId:uid,uid,username,email,categories:JSON.stringify(categories),duration:'1 year',durationMs:31536000000,createdAt:new Date(now).toISOString(),expiresAt:new Date(activationExpires).toISOString(),codeExpiresAt:new Date(codeExpires).toISOString(),used:false,redeemed:false,active:false,source:'paystack',paymentReference,paymentCurrency:currency,paymentAmount:amount,paymentId:Number(tx.id||0),paymentStatus:'success',activationCodeEmailSent:false});"),
("metadata:{uid:u.localId,categories:cats,durationMs:31536000000,product:'eduwills_activation',country:body.country||'INT',email:u.email}",
 "metadata:{uid:u.localId,categories:cats,durationMs:31536000000,product:'eduwills_activation',country:body.country||'INT',email:u.email,fullName,username}")
])

patch('app/dashboard/page.tsx', [
("const identity=String(d.fullName?.split(' ')[0]||d.username||u.displayName||'').trim();", "const identity=String(d.fullName?.split(' ')[0]||u.displayName||d.username||'').trim();")
])

patch('components/ContactSupport.tsx', [
('className="fixed bottom-5 right-5 z-50', 'className="fixed bottom-24 right-5 z-50')
])

patch('admin/page.tsx', [
("id: string; uid?: string; fullName?: string; username?: string; phone?: string;", "id: string; uid?: string; fullName?: string; username?: string; email?: string; phone?: string;"),
("const userName = (uid: string) => { const u = users.find(x => (x.uid || x.id) === uid); return u?.fullName || (u?.username ? `@${u.username}` : uid); };", "const userName = (uid: string) => { const u = users.find(x => (x.uid || x.id) === uid); return u?.fullName || (u?.username ? `@${u.username}` : u?.email || 'Unnamed user'); };")
])
