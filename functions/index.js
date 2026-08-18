const { onRequest } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

// Values are injected by the GitHub Actions deployment into the function's
// project environment at deploy time. They never live in the repository.
const GROQ_API_KEY = defineString('GROQ_API_KEY');
const OPENROUTER_API_KEY = defineString('OPENROUTER_API_KEY');

const json = (res, status, body) => {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(body));
};

async function callGroq(key, prompt) {
  if (!key) throw new Error('GROQ_NOT_CONFIGURED');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b', temperature: 0.2, max_tokens: 9000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are the EduWills factual quiz generator. Return only valid JSON matching the requested schema. Never invent book facts.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!r.ok) { const text = await r.text(); const e = new Error(`GROQ_${r.status}`); e.status = r.status; e.detail = text.slice(0, 500); throw e; }
  const d = await r.json(); return d?.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(key, prompt) {
  if (!key) throw new Error('OPENROUTER_NOT_CONFIGURED');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://chineduwilliams739-commits.github.io/eduwills/', 'X-Title': 'EduWills' },
    body: JSON.stringify({
      model: 'openrouter/free', temperature: 0.2, max_tokens: 9000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are the EduWills factual quiz generator. Return only valid JSON matching the requested schema. Never invent book facts.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!r.ok) { const text = await r.text(); const e = new Error(`OPENROUTER_${r.status}`); e.status = r.status; e.detail = text.slice(0, 500); throw e; }
  const d = await r.json(); return d?.choices?.[0]?.message?.content || '';
}

exports.quizAiRouter = onRequest(
  { region: 'us-central1', timeoutSeconds: 45, memory: '256MiB', cors: true },
  async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
    try {
      const authHeader = String(req.get('authorization') || '');
      if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required' });
      await getAuth().verifyIdToken(authHeader.slice(7));
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt || prompt.length > 140000) return json(res, 400, { error: 'Invalid prompt' });

      const providers = [
        ['groq', () => callGroq(GROQ_API_KEY.value(), prompt)],
        ['openrouter', () => callOpenRouter(OPENROUTER_API_KEY.value(), prompt)]
      ];
      const failures = [];
      for (const [provider, call] of providers) {
        try { const text = await call(); if (text) return json(res, 200, { provider, text }); }
        catch (e) { failures.push({ provider, status: e.status || 0, code: e.message || 'provider_error' }); }
      }
      return json(res, 503, { error: 'AI providers unavailable', failures });
    } catch (e) { return json(res, 500, { error: 'AI router failure' }); }
  }
);

// Provider router v3: avoids requiring Secret Manager permissions during CI deployment.
