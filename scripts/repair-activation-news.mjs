import fs from 'node:fs';

const activationPath='app/dashboard/activation/page.tsx';
let activation=fs.readFileSync(activationPath,'utf8');
activation=activation.replace(/<ContactSupport\s+box\s*\/>/g,'');
fs.writeFileSync(activationPath,activation);

await import('./harden-community-groups.mjs');
await import('./fix-category-persistence-and-personal.mjs');
await import('./harden-group-workspace-syntax.mjs');
console.log('Legacy activation cleanup, community hardening, category persistence, and group workspace hardening applied safely.');
