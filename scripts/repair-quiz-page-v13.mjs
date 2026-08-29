import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Normalize escaped JSX characters from previous repair attempts.
s = s.replaceAll('\\<', '<');
s = s.replaceAll('\\>', '>');
s = s.replaceAll('\\`', '`');

// Repair malformed onChange fragments if present.
s = s.replace(
  /onChange=\{\(e\)\s*=>\s*className="[^"]*"\s*data-eduwills-styled="true">\s*([^}]+)\}/g,
  'onChange={(e) => $1}'
);

const component = `
function QuizDropdown({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const current =
    options.find((option) => option.value === value)?.label ||
    options[0]?.label ||
    'Select';

  return (
    <div className="relative z-30">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 text-left font-black text-slate-700 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100"
      >
        <span className="truncate">{current}</span>
        <ChevronDown
          size={19}
          className={
            open
              ? 'shrink-0 transition-transform rotate-180'
              : 'shrink-0 transition-transform'
          }
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[100] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={
                option.value === value
                  ? 'mb-1 flex w-full items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-left text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50'
                  : 'mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-indigo-50'
              }
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={17} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
`;

function parseOptions(body) {
  const out = [];

  // Supports both single and double quoted option values.
  const re =
    /<option\b[^>]*\bvalue\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/option>/gi;

  let match;

  while ((match = re.exec(body)) !== null) {
    const value = match[2];
    const label = match[3]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    out.push({
      value,
      label,
    });
  }

  return out;
}

function findSelectForState(state) {
  const marker = new RegExp(
    `<select\\b[^>]*\\bvalue\\s*=\\s*\\{\\s*${state}\\s*\\}[^>]*>[\\s\\S]*?<\\/select>`,
    'i'
  );

  const match = s.match(marker);

  if (match) {
    return match[0];
  }

  // Fallback: value may not be immediately after <select.
  const allSelects = s.match(/<select\b[\s\S]*?<\/select>/gi) || [];

  for (const select of allSelects) {
    if (
      new RegExp(
        `value\\s*=\\s*\\{\\s*${state}\\s*\\}`,
        'i'
      ).test(select)
    ) {
      return select;
    }
  }

  return null;
}

function replaceSelect(state, handler) {
  // If this dropdown has already been repaired, don't try to repair it again.
  if (
    new RegExp(
      `<QuizDropdown\\b[^>]*\\blabel=["']${state}["']`,
      'i'
    ).test(s)
  ) {
    console.log(`${state} dropdown already uses QuizDropdown; skipping.`);
    return 1;
  }

  const whole = findSelectForState(state);

  if (!whole) {
    throw new Error(
      `Could not find native select for ${state} dropdown`
    );
  }

  const options = parseOptions(whole);

  if (!options.length) {
    throw new Error(
      `No options found for ${state} dropdown. Select found but it contains no supported <option> elements.`
    );
  }

  const replacement =
    `<QuizDropdown label="${state}" ` +
    `value={String(${state})} ` +
    `options={${JSON.stringify(options)}} ` +
    `onChange={${handler}} />`;

  s = s.replace(whole, replacement);

  console.log(
    `Replaced ${state} dropdown with ${options.length} options.`
  );

  return 1;
}

// Insert the component only when it is not already present.
if (!s.includes('function QuizDropdown(')) {
  const marker =
    "function cleanText(text: string) { return String(text || '').replace(/```[\\s\\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\\s+/g, ' ').trim();";

  const at = s.indexOf(marker);

  if (at < 0) {
    throw new Error('Quiz page insertion marker not found');
  }

  s =
    s.slice(0, at + marker.length) +
    component +
    s.slice(at + marker.length);
}

let total = 0;

total += replaceSelect(
  'slot',
  "(v) => setSlot(v ? Number(v) : '')"
);

total += replaceSelect(
  'duration',
  'setDuration'
);

total += replaceSelect(
  'difficulty',
  'setDifficulty'
);

if (total !== 3) {
  throw new Error(
    `Expected to process 3 Quiz Studio dropdowns, processed ${total}`
  );
}

if (/<select\b/i.test(s)) {
  throw new Error(
    'A native Quiz Studio select remains after repair'
  );
}

if (!s.includes('function QuizDropdown(')) {
  throw new Error('QuizDropdown component missing');
}

fs.writeFileSync(path, s, 'utf8');

console.log(
  'Quiz page v13 applied successfully: functional custom dropdowns for slot, duration, and difficulty.'
);
