import fs from 'node:fs';

// This deployment repair used to rewrite app source with broad regular
// expressions. That was unsafe: a semicolon inside an arrow-function predicate
// could cause only part of a line to be replaced and make the Next.js build
// invalid. The Admin and AI source now contain their own authoritative logic,
// so this script is intentionally validation-only.

const requiredFiles = [
  'app/admin/page.tsx',
  'app/dashboard/ai/page.tsx',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Required EDUWILLS file is missing: ${file}`);
}

const admin = fs.readFileSync('app/admin/page.tsx', 'utf8');
const ai = fs.readFileSync('app/dashboard/ai/page.tsx', 'utf8');

if (!admin.includes('const userTokens')) throw new Error('Admin WilliToken handling is missing.');
if (!admin.includes('expiryDate')) throw new Error('Admin expiry handling is missing.');
if (!ai.includes('getAiEntitlement')) throw new Error('EDUWILLS AI entitlement handling is missing.');

console.log('WilliToken lifecycle validation passed. No source rewriting was performed.');
