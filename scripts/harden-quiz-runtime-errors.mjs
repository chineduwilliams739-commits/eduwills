import fs from 'node:fs';

const clientPath = 'lib/quizAiClientStable.ts';
let client = fs.readFileSync(clientPath, 'utf8');

client = client.replace(
  "    if (!response.ok) {\n      throw new Error(String(data?.error || `AI_GATEWAY_${response.status}`));\n    }",
  "    if (!response.ok) {\n      const detail = String(data?.error || data?.message || '').trim();\n      throw new Error(`AI_GATEWAY_${response.status}${detail ? `: ${detail}` : ''}`);\n    }",
);

client = client.replace(
  "  let lastError: unknown;\n\n  try {\n    const text = await gateway(prompt, 25000);",
  "  let gatewayError = '';\n  let fallbackError = '';\n\n  try {\n    const text = await gateway(prompt, 25000);",
);

client = client.replace(
  "  } catch (error) {\n    lastError = error;\n  }\n\n  try {\n    const fallbackText = await geminiText(prompt, 25000);",
  "  } catch (error) {\n    gatewayError = error instanceof Error ? error.message : String(error);\n  }\n\n  try {\n    const fallbackText = await geminiText(prompt, 25000);",
);

client = client.replace(
  "  } catch (fallbackError) {\n    lastError = fallbackError;\n  }\n\n  throw lastError instanceof Error ? lastError : new Error('AI generation failed');",
  "  } catch (error) {\n    fallbackError = error instanceof Error ? error.message : String(error);\n  }\n\n  const details = [\n    gatewayError ? `gateway=${gatewayError}` : '',\n    fallbackError ? `firebase=${fallbackError}` : '',\n  ].filter(Boolean).join(' | ');\n  throw new Error(details ? `AI_GENERATION_FAILED: ${details}` : 'AI_GENERATION_FAILED');",
);

fs.writeFileSync(clientPath, client);

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

page = page.replace(
  "      setQuizError(\n        e?.message === 'AI_QUOTA_EXHAUSTED'\n          ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.'\n          : 'EDUWILLS AI could not finish the requested batch. Please try again.'\n      );",
  "      const rawError = e instanceof Error ? e.message : String(e?.message || e || 'Unknown error');\n      setQuizError(\n        rawError === 'AI_QUOTA_EXHAUSTED'\n          ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.'\n          : rawError === 'AUTHENTICATION_REQUIRED'\n            ? 'Your EDUWILLS login session is not ready. Please sign in again and retry.'\n            : rawError || 'EDUWILLS AI could not finish the requested batch. Please try again.'\n      );",
);

fs.writeFileSync(pagePath, page);
console.log('Quiz runtime error diagnostics hardened safely.');
