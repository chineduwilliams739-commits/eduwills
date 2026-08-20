import fs from 'node:fs';

const file = 'scripts/repair-quiz-ui-free-count.mjs';
let s = fs.readFileSync(file, 'utf8');

// The repair script must contain JSX template text without evaluating its
// ${...} expressions while the repair script itself is running. In
// particular, the slot label previously evaluated the map callback's `i`
// in the wrong scope under Node 24.
const fixed = `const newSlot = \`<Menu label="Save to slot" value={slot} options={slots.map((b,i)=>({value:String(i+1),label:"Slot "+(i+1)})).filter((_,i)=>!slots[i])} onChange={(v)=>setSlot(v ? Number(v) : '')}/>\`;`;

const re = /^const newSlot = .*$/m;
if (!re.test(s)) throw new Error('broken newSlot declaration not found');
s = s.replace(re, fixed);
fs.writeFileSync(file, s);
console.log('Quiz UI repair script syntax corrected.');
