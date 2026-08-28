import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(/\\<(?=\/?[A-Za-z])/g, '<').replace(/\\>/g, '>').replace(/\\`/g, '`');
s = s.replace(/onChange=\{\(e\)\s*=\s*className="[^"]*"\s*data-eduwills-styled="true">\s*([^}]+)\}/g, 'onChange={(e) => $1}');

const component = `
function QuizDropdown({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label || options[0]?.label || 'Select';
  return (
    <div className="relative z-30">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 text-left font-black text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100">
        <span className="truncate">{current}</span><ChevronDown size={19} className={\`shrink-0 transition-transform \${open ? 'rotate-180' : ''}\`} />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className="absolute left-0 right-0 top-[calc(100%+8px)] z-[100] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {options.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={\`mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors hover:bg-indigo-50 \${option.value === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}\`}>
              <span>{option.label}</span>{option.value === value && <Check size={17} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
`;

if (!s.includes('function QuizDropdown(')) {
  const marker = "function cleanText(text: string) { return String(text || '').replace(/```[\\s\\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\\s+/g, ' ').trim(); }";
  const at = s.indexOf(marker);
  if (at < 0) throw new Error('Quiz page insertion marker not found');
  s = s.slice(0, at + marker.length) + component + s.slice(at + marker.length);
}

function parseOptions(body) {
  const out = [];
  const re = /<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g;
  let m;
  while ((m = re.exec(body))) out.push({ value: m[1], label: m[2].replace(/\s+/g, ' ').trim() });
  return out;
}

function replaceSelect(state, handler) {
  const escapedState = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<select\\s+value=\\{${escapedState}\\}[\\s\\S]*?<\\/select>`, 'g');
  let changed = 0;
  s = s.replace(re, (whole) => {
    const body = whole.slice(whole.indexOf('>') + 1, whole.lastIndexOf('</select>'));
    const options = parseOptions(body);
    if (!options.length) throw new Error(`No options found for ${state} dropdown`);
    changed += 1;
    return `<QuizDropdown label="${state}" value={String(${state})} options={${JSON.stringify(options)}} onChange={${handler}} />`;
  });
  return changed;
}

let total = 0;
total += replaceSelect('slot', "(v) => setSlot(v ? Number(v) : '')");
total += replaceSelect('duration', 'setDuration');
total += replaceSelect('difficulty', 'setDifficulty');

if (total !== 3) throw new Error(`Expected to replace 3 Quiz Studio dropdowns, replaced ${total}`);
if (/<select\b/.test(s)) throw new Error('A native Quiz Studio select remains');
if (!s.includes('function QuizDropdown(')) throw new Error('QuizDropdown component missing');

fs.writeFileSync(path, s, 'utf8');
console.log('Quiz page v13 applied: functional custom dropdowns for slot, duration, and difficulty.');
