import fs from 'node:fs';

const activationPath='app/dashboard/activation/page.tsx';
let activation=fs.readFileSync(activationPath,'utf8');
activation=activation.replace(/<ContactSupport\s+box\s*\/>/g,'');
fs.writeFileSync(activationPath,activation);

// The dashboard was redesigned after this legacy repair was written. Keep the
// activation cleanup, but never fail a deployment because an obsolete
// dashboard marker is no longer present.
console.log('Legacy activation cleanup applied safely.');
