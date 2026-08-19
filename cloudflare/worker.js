import { jwtVerify, createRemoteJWKSet } from 'jose';

const PROJECT = 'eduwills';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ORIGIN = 'https://chineduwilliams739-commits.github.io';
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...CORS}});

async function verify(request){const h=request.headers.get('Authorization')||'';if(!h.startsWith('Bearer '))throw Error('AUTH_REQUIRED');await jwtVerify(h.slice(7),JWKS,{issuer:ISSUER,audience:PROJECT});}
async function callProvider(url,key,body,headers,timeout=15000){if(!key)throw Error('NOT_CONFIGURED');const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',signal:c.signal,headers,body:JSON.stringify(body)});if(!r.ok)throw Error(`HTTP_${r.status}`);const d=await r.json();return d?.choices?.[0]?.message?.content||''}finally{clearTimeout(t)}}
function promptBody(prompt){return {temperature:0.2,max_tokens:9000,messages:[{role:'system',content:'You are the EduWills factual quiz generator. Follow every user instruction exactly. Use only supported book facts. Never invent scenes, characters, dates or quotations. Return ONLY valid JSON in the exact requested shape.'},{role:'user',content:prompt}]}}

export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(request.method!=='POST')return out({error:'POST_REQUIRED'},405);try{await verify(request);const data=await request.json();const prompt=String(data?.prompt||'').trim();if(!prompt||prompt.length>120000)return out({error:'INVALID_PROMPT'},400);const failures=[];
 try{const text=await callProvider('https://api.groq.com/openai/v1/chat/completions',env.GROQ_API_KEY,{...promptBody(prompt),model:'openai/gpt-oss-20b'},{Authorization:`Bearer ${env.GROQ_API_KEY}`,'Content-Type':'application/json'});if(text)return out({provider:'groq',text})}catch(e){failures.push({provider:'groq',error:String(e?.message||e).slice(0,100)})}
 try{const text=await callProvider('https://openrouter.ai/api/v1/chat/completions',env.OPENROUTER_API_KEY,{...promptBody(prompt),model:'openrouter/free'},{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':ORIGIN,'X-Title':'EduWills'});if(text)return out({provider:'openrouter',text})}catch(e){failures.push({provider:'openrouter',error:String(e?.message||e).slice(0,100)})}
 return out({error:'AI_TEMPORARILY_UNAVAILABLE',message:'AI quiz generation is temporarily unavailable. Please try again shortly.',failures},503);
 }catch(e){if(e?.message==='AUTH_REQUIRED'||String(e?.code||'').startsWith('ERR_JWT'))return out({error:'AUTHENTICATION_REQUIRED'},401);return out({error:'AI_GATEWAY_ERROR'},500)}}};
