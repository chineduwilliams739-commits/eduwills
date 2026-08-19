import { jwtVerify, createRemoteJWKSet } from 'jose';

const PROJECT = 'eduwills';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const ORIGIN = 'https://chineduwilliams739-commits.github.io';
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };

const out = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

async function verify(request) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  await jwtVerify(h.slice(7), JWKS, { issuer: ISSUER, audience: PROJECT });
}

const baseBody = (prompt, model) => ({ model, temperature: 0.2, max_tokens: 9000, response_format: { type: 'json_object' }, messages: [
  { role: 'system', content: 'You are the EduWills factual quiz generator. Return only valid JSON matching the requested schema. Follow the user instructions exactly. Never invent book facts. Avoid duplicates and generic questions.' },
  { role: 'user', content: prompt }
] });

async function provider(fetchUrl, key, body, headers, timeout = 18000) {
  if (!key) throw new Error('NOT_CONFIGURED');
  const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(fetchUrl, { method: 'POST', signal: c.signal, headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`HTTP_${r.status}`);
    const d = await r.json();
    return d?.choices?.[0]?.message?.content || '';
  } finally { clearTimeout(t); }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return out({ error: 'POST_REQUIRED' }, 405);
    try {
      await verify(request);
      const data = await request.json();
      const prompt = String(data?.prompt || '').trim();
      if (!prompt || prompt.length > 140000) return out({ error: 'INVALID_PROMPT' }, 400);
      const failures = [];
      try {
        const text = await provider('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, baseBody(prompt, 'openai/gpt-oss-20b'), { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' });
        if (text) return out({ provider: 'groq', text });
      } catch (e) { failures.push({ provider: 'groq', error: String(e.message).slice(0, 80) }); }
      try {
        const text = await provider('https://openrouter.ai/api/v1/chat/completions', env.OPENROUTER_API_KEY, baseBody(prompt, 'openrouter/free'), { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': ORIGIN, 'X-Title': 'EduWills' });
        if (text) return out({ provider: 'openrouter', text });
      } catch (e) { failures.push({ provider: 'openrouter', error: String(e.message).slice(0, 80) }); }
      return out({ error: 'AI_TEMPORARILY_UNAVAILABLE', message: 'AI quiz generation is temporarily unavailable. Please try again shortly.', failures }, 503);
    } catch (e) {
      if (e.message === 'AUTH_REQUIRED' || String(e.code || '').startsWith('ERR_JWT')) return out({ error: 'AUTHENTICATION_REQUIRED' }, 401);
      return out({ error: 'AI_GATEWAY_ERROR' }, 500);
    }
  }
};
