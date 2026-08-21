import fs from 'node:fs';

// Compatibility step. The v2 script used brittle source matching and could abort
// the deployment when a newer Admin repair had already changed the same block.
// v4/v5 are now the authoritative lifecycle repairs, so v2 only validates the
// files and intentionally makes no source edits.
const required = [
  'app/admin/page.tsx',
  'app/dashboard/activation/page.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/ai/page.tsx',
];
for (const path of required) fs.accessSync(path, fs.constants.R_OK);
console.log('WilliToken lifecycle v2 compatibility step passed; authoritative lifecycle repairs will run in v4/v5.');
