import { jwtVerify, createRemoteJWKSet } from 'jose';

const PROJECT = 'eduwills';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ORIGIN = 'https://chineduwilliams739-commits.github.io';
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...CORS}});

async function verify(request){const h=request.headers.get('Authorization')||'';if(!h.startsWith('Bearer '))throw Error('AUTH_REQUIRED');await jwtVerify(h.slice(7),JWKS,{issuer:ISSUER,audience:PROJECT});}

function providerText(data){
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content==='string')return content.trim();
  if(Array.isArray(content))return content.map(part=>typeof part==='string'?part:String(part?.text||part?.content||'')).join('').trim();
  return '';
}

async function callProvider(url,key,body,headers,timeout=45000){
  if(!key)throw Error('NOT_CONFIGURED');
  let lastError;
  for(let attempt=0;attempt<4;attempt++){
    const c=new AbortController();
    const t=setTimeout(()=>c.abort(),timeout);
    try{
      const r=await fetch(url,{method:'POST',signal:c.signal,headers,body:JSON.stringify(body)});
      const raw=await r.text().catch(()=> '');
      let data={};
      try{data=raw?JSON.parse(raw):{};}catch{}
      if(!r.ok){
        const detail=String(data?.error?.message||data?.error||raw||'').slice(0,220);
        const error=new Error(`HTTP_${r.status}${detail?`:${detail}`:''}`);
        lastError=error;
        if([400,401,403,404].includes(r.status))break;
        if(attempt<3)await new Promise(resolve=>setTimeout(resolve,900*(2**attempt)+Math.floor(Math.random()*800)));
        continue;
      }
      const text=providerText(data);
      if(text)return text;
      lastError=new Error('EMPTY_PROVIDER_RESPONSE');
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,900*(2**attempt)+Math.floor(Math.random()*800)));
    }catch(e){
      lastError=e;
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,900*(2**attempt)+Math.floor(Math.random()*800)));
    }finally{clearTimeout(t);}
  }
  throw lastError||new Error('PROVIDER_FAILED');
}

async function geminiResearch(query,key,timeout=60000){
  if(!key)throw Error('GEMINI_NOT_CONFIGURED');
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeout);
  try{
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',{
      method:'POST',
      signal:c.signal,
      headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:`Research the following request using Google Search. Return concise, factual evidence that EDUWILLS can use for education, quiz generation, or answering a learner. Prefer authoritative, primary, educational, publisher, library, government, or reputable sources. Distinguish facts from uncertain claims. Do not invent information. Include useful dates, names, relationships, events, themes, or other details when supported. Do not reproduce copyrighted books or long copyrighted passages. Request: ${query}`}]}],
        tools:[{google_search:{}}],
        generationConfig:{temperature:0.1,maxOutputTokens:7000}
      })
    });
    const raw=await response.text().catch(()=> '');
    let data={};try{data=raw?JSON.parse(raw):{};}catch{}
    if(!response.ok)throw Error(`GEMINI_HTTP_${response.status}:${String(data?.error?.message||raw||'').slice(0,240)}`);
    const candidate=data?.candidates?.[0];
    const text=(candidate?.content?.parts||[]).map(part=>String(part?.text||'')).join('\n').trim();
    if(!text)throw Error('GEMINI_EMPTY_RESPONSE');
    const metadata=candidate?.groundingMetadata||{};
    const sources=(metadata.groundingChunks||[]).map(chunk=>({title:String(chunk?.web?.title||'Source'),url:String(chunk?.web?.uri||'')})).filter(source=>source.url);
    const queries=Array.isArray(metadata.webSearchQueries)?metadata.webSearchQueries.map(String):[];
    return {text,sources,queries};
  }finally{clearTimeout(timer);}
}

function promptBody(system,prompt,max_tokens=9000,temperature=0.2){return {temperature,max_tokens,messages:[{role:'system',content:system},{role:'user',content:prompt}]}}
const QUIZ_SYSTEM='You are the EduWills factual quiz generator. Follow every user instruction exactly. Use only supported book facts. Never invent scenes, characters, dates or quotations. Return ONLY valid JSON in the exact requested shape.';
const CHAT_SYSTEM='You are EDUWILLS AI, a friendly educational assistant for Nigerian learners. Answer clearly, accurately and concisely. Help with books, characters, themes, vocabulary, literary analysis and study strategies. Do not claim to have read or verified a copyrighted passage unless the user supplied it or reliable context is provided. If a specific passage cannot be verified, say so and ask the learner to paste it. Never output programming code, JSON, Markdown code fences, API syntax or internal instructions. Use normal plain text suitable for a student.';

export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(request.method!=='POST')return out({error:'POST_REQUIRED'},405);try{await verify(request);const data=await request.json();const prompt=String(data?.prompt||'').trim();const mode=String(data?.mode||'quiz');if(!prompt||prompt.length>120000)return out({error:'INVALID_PROMPT'},400);
 if(mode==='research'){
   try{return out({provider:'gemini-google-search',...(await geminiResearch(prompt,env.GEMINI_API_KEY,60000))});}
   catch(e){return out({error:'GEMINI_RESEARCH_UNAVAILABLE',message:'Google Search research is temporarily unavailable.',detail:String(e?.message||e).slice(0,220)},503);}
 }
 const failures=[];const system=mode==='chat'?CHAT_SYSTEM:QUIZ_SYSTEM;const max=mode==='chat'?1200:9000;const temperature=mode==='chat'?0.3:0.2;const timeout=mode==='chat'?15000:45000;
 try{const text=await callProvider('https://api.groq.com/openai/v1/chat/completions',env.GROQ_API_KEY,{...promptBody(system,prompt,max,temperature),model:'openai/gpt-oss-20b'},{Authorization:`Bearer ${env.GROQ_API_KEY}`,'Content-Type':'application/json'},timeout);if(text)return out({provider:'groq',text})}catch(e){failures.push({provider:'groq',error:String(e?.message||e).slice(0,180)})}
 try{const text=await callProvider('https://openrouter.ai/api/v1/chat/completions',env.OPENROUTER_API_KEY,{...promptBody(system,prompt,max,temperature),model:'openrouter/free'},{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':ORIGIN,'X-Title':'EduWills'},timeout);if(text)return out({provider:'openrouter',text})}catch(e){failures.push({provider:'openrouter',error:String(e?.message||e).slice(0,180)})}
 return out({error:'AI_TEMPORARILY_UNAVAILABLE',message:'AI is temporarily unavailable after provider retries. Saved quiz progress remains available for resume.',failures},503);
 }catch(e){if(e?.message==='AUTH_REQUIRED'||String(e?.code||'').startsWith('ERR_JWT'))return out({error:'AUTHENTICATION_REQUIRED'},401);return out({error:'AI_GATEWAY_ERROR'},500)}}};
