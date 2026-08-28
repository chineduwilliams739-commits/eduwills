import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

const ORIGIN = 'https://chineduwilliams739-commits.github.io';

async function callProvider(url, key, body, headers, timeout = 45000) {
  if (!key) throw new Error('NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { method: 'POST', signal: controller.signal, headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally { clearTimeout(timer); }
}

function buildServer(env) {
  const server = new McpServer({ name: 'EduWills AI Quiz', version: '1.0.0' });
  server.registerTool('generate_quiz', {
    title: 'Generate an EduWills quiz',
    description: 'Generate an educational quiz from a book, author, school subject, exam topic, or learning topic. Use this when the user asks for quiz questions, practice questions, a book quiz, WAEC/JAMB/NECO practice, literature questions, or wants to be tested.',
    inputSchema: z.object({
      topic: z.string().min(2).max(500).describe('Book title, school subject, exam topic, or learning topic'),
      author: z.string().max(200).optional().describe('Author if the topic is a book'),
      questionCount: z.number().int().min(5).max(30).default(10).describe('Number of questions')
    })
  }, async ({ topic, author, questionCount }) => {
    const prompt = `Create ${questionCount} high-quality multiple-choice quiz questions about: ${topic}${author ? ` by ${author}` : ''}. Return JSON exactly as {"title":string,"questions":[{"question":string,"options":[string,string,string,string],"answer":number,"explanation":string}]}. For Nigerian exam topics, make questions appropriate for WAEC/JAMB/NECO style where relevant. Do not invent book facts.`;
    const system = 'You are the EduWills factual quiz generator. Use only supported book facts. Never invent scenes, characters, dates or quotations. Return only valid JSON.';
    const body = { model: 'openai/gpt-oss-20b', temperature: 0.2, max_tokens: 9000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
    try {
      const text = await callProvider('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, body, { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' });
      if (text) return { content: [{ type: 'text', text }], structuredContent: { topic, questionCount, source: 'EduWills' } };
    } catch {}
    try {
      const text = await callProvider('https://openrouter.ai/api/v1/chat/completions', env.OPENROUTER_API_KEY, { ...body, model: 'openrouter/free' }, { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': ORIGIN, 'X-Title': 'EduWills' });
      if (text) return { content: [{ type: 'text', text }], structuredContent: { topic, questionCount, source: 'EduWills' } };
    } catch {}
    return { isError: true, content: [{ type: 'text', text: 'EduWills AI is temporarily unavailable. Please try again shortly.' }] };
  });
  server.registerTool('open_eduwills', { title: 'Open EduWills', description: 'Open the full EduWills platform for saved quiz history, progress tracking, account activation, and additional study features.', inputSchema: z.object({}) }, async () => ({ content: [{ type: 'text', text: `Open EduWills: ${ORIGIN}/eduwills/` }] }));
  return server;
}

export default {
  fetch(request, env) {
    const handler = createMcpHandler(() => buildServer(env));
    return handler.fetch(request);
  }
};
