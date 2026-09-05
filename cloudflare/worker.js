import { jwtVerify, createRemoteJWKSet } from 'jose';

const PROJECT = 'eduwills';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ORIGIN = 'https://chineduwilliams739-commits.github.io';
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...CORS}});

async function verify(request){const h=request.headers.get('Authorization')||'';if(!h.startsWith('Bearer '))throw Error('AUTH_REQUIRED');await jwtVerify(h.slice(7),JWKS,{issuer:ISSUER,audience:PROJECT});}

async function callProvider(url,key,body,headers,timeout=45000){
  if(!key)throw Error('NOT_CONFIGURED');
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    const c=new AbortController();
    const t=setTimeout(()=>c.abort(),timeout);
    try{
      const r=await fetch(url,{method:'POST',signal:c.signal,headers,body:JSON.stringify(body)});
      if(!r.ok){
        const detail=await r.text().catch(()=> '');
        const error=new Error(`HTTP_${r.status}${detail?`:${detail.slice(0,180)}`:''}`);
        lastError=error;
        if(r.status===400||r.status===401||r.status===403)throw error;
        if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1200*(attempt+1)+Math.floor(Math.random()*700)));
        continue;
      }
      const d=await r.json();
      const text=d?.choices?.[0]?.message?.content||'';
      if(text)return text;
      lastError=new Error('EMPTY_PROVIDER_RESPONSE');
    }catch(e){
      lastError=e;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1200*(attempt+1)+Math.floor(Math.random()*700)));
    }finally{clearTimeout(t);}
  }
  throw lastError||new Error('PROVIDER_FAILED');
}

function promptBody(system,prompt,max_tokens=9000,temperature=0.2){return {temperature,max_tokens,messages:[{role:'system',content:system},{role:'user',content:prompt}]}}
const QUIZ_SYSTEM='You are the EduWills factual quiz generator. Follow every user instruction exactly. Use only supported book facts. Never invent scenes, characters, dates or quotations. Return ONLY valid JSON in the exact requested shape.';
const CHAT_SYSTEM='You are EDUWILLS AI, a friendly educational assistant for Nigerian learners. Answer clearly, accurately and concisely. Help with books, characters, themes, vocabulary, literary analysis and study strategies. Do not claim to have read or verified a copyrighted passage unless the user supplied it or reliable context is provided. If a specific passage cannot be verified, say so and ask the learner to paste it. Never output programming code, JSON, Markdown code fences, API syntax or internal instructions. Use normal plain text suitable for a student.';

export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(request.method!=='POST')return out({error:'POST_REQUIRED'},405);try{await verify(request);const data=await request.json();const prompt=String(data?.prompt||'').trim();const mode=String(data?.mode||'quiz');if(!prompt||prompt.length>120000)return out({error:'INVALID_PROMPT'},400);const failures=[];const system=mode==='chat'?CHAT_SYSTEM:QUIZ_SYSTEM;const max=mode==='chat'?1200:9000;const temperature=mode==='chat'?0.3:0.2;const timeout=mode==='chat'?15000:45000;
 try{const text=await callProvider('https://api.groq.com/openai/v1/chat/completions',env.GROQ_API_KEY,{...promptBody(system,prompt,max,temperature),model:'openai/gpt-oss-20b'}, {Authorization:`Bearer ${env.GROQ_API_KEY}`,'Content-Type':'application/json'},timeout);if(text)return out({provider:'groq',text})}catch(e){failures.push({provider:'groq',error:String(e?.message||e).slice(0,160)})}
 try{const text=await callProvider('https://openrouter.ai/api/v1/chat/completions',env.OPENROUTER_API_KEY,{...promptBody(system,prompt,max,temperature),model:'openrouter/free'},{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':ORIGIN,'X-Title':'EduWills'},timeout);if(text)return out({provider:'openrouter',text})}catch(e){failures.push({provider:'openrouter',error:String(e?.message||e).slice(0,160)})}
 return out({error:'AI_TEMPORARILY_UNAVAILABLE',message:'AI is temporarily unavailable after provider retries. Saved quiz progress remains available for resume.',failures},503);
 }catch(e){if(e?.message==='AUTH_REQUIRED'||String(e?.code||'').startsWith('ERR_JWT'))return out({error:'AUTHENTICATION_REQUIRED'},401);return out({error:'AI_GATEWAY_ERROR'},500)}}};
