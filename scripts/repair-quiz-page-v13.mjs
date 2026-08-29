import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');

const dropdownComponent = `
function QuizDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
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
          className={\`shrink-0 transition-transform \${open ? 'rotate-180' : ''}\`}
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
              className={\`mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors hover:bg-indigo-50 \${
                option.value === value
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700'
              }\`}
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

function insertComponent() {
  if (s.includes('function QuizDropdown(')) {
    return false;
  }

  const marker =
    "function cleanText(text: string) { return String(text || '').replace(/```[\\s\\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\\s+/g, ' ').trim(); }";

  const at = s.indexOf(marker);

  if (at < 0) {
    throw new Error('Could not find Quiz Studio insertion point.');
  }

  s =
    s.slice(0, at + marker.length) +
    '\n' +
    dropdownComponent +
    s.slice(at + marker.length);

  return true;
}

function parseOptions(body) {
  const options = [];
  const optionRegex =
    /<option(?:\s+[^>]*)?value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;

  let match;

  while ((match = optionRegex.exec(body))) {
    options.push({
      value: match[1],
      label: match[2].replace(/\s+/g, ' ').trim(),
    });
  }

  return options;
}

function alreadyConverted(state) {
  const patterns = [
    `value={String(${state})}`,
    `value={${state}}`,
  ];

  return patterns.some((pattern) => s.includes(`<QuizDropdown`) && s.includes(pattern));
}

function findNativeSelectForState(state) {
  const stateEscaped = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const patterns = [
    new RegExp(
      `<select\\s+value=\\{${stateEscaped}\\}[\\s\\S]*?<\\/select>`,
      'gi'
    ),
    new RegExp(
      `<select[\\s\\S]*?value=\\{${stateEscaped}\\}[\\s\\S]*?<\\/select>`,
      'gi'
    ),
  ];

  for (const regex of patterns) {
    const match = regex.exec(s);

    if (match) {
      return {
        regex,
        whole: match[0],
      };
    }
  }

  return null;
}

function replaceStateDropdown(state, handler) {
  if (alreadyConverted(state)) {
    console.log(`Skipped ${state} dropdown: already converted.`);
    return 1;
  }

  const found = findNativeSelectForState(state);

  if (!found) {
    console.log(
      `Skipped ${state} dropdown: native select not found. It may already be repaired or may use a different implementation.`
    );
    return 0;
  }

  const whole = found.whole;

  const firstOpen = whole.indexOf('>');
  const lastClose = whole.lastIndexOf('</select>');

  if (firstOpen < 0 || lastClose < 0 || lastClose <= firstOpen) {
    throw new Error(`Could not parse native ${state} dropdown.`);
  }

  const body = whole.slice(firstOpen + 1, lastClose);
  const options = parseOptions(body);

  if (!options.length) {
    throw new Error(
      `No options found for ${state} dropdown. The select exists but contains no native option elements.`
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

insertComponent();

let total = 0;

total += replaceStateDropdown(
  'slot',
  '(v) => setSlot(v ? Number(v) : "")'
);

total += replaceStateDropdown(
  'duration',
  'setDuration'
);

total += replaceStateDropdown(
  'difficulty',
  'setDifficulty'
);

if (!s.includes('function QuizDropdown(')) {
  throw new Error('QuizDropdown component is missing.');
}

/*
 * Do not fail the deployment merely because an old native select
 * is absent. The page may already have been repaired by an earlier run.
 *
 * We only fail if the three required custom dropdowns are not present
 * after this script finishes.
 */

const requiredDropdowns = [
  'value={String(slot)}',
  'value={String(duration)}',
  'value={String(difficulty)}',
];

for (const marker of requiredDropdowns) {
  if (!s.includes(marker)) {
    throw new Error(
      `Required custom QuizDropdown is missing: ${marker}`
    );
  }
}

fs.writeFileSync(path, s, 'utf8');

console.log(
  'Quiz page v13 completed successfully. Existing custom dropdowns were preserved and any remaining native dropdowns were converted.'
);
