import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// IMPORTANT: this repair script must never rewrite existing Admin JSX/function
// bodies. Earlier versions used a semicolon-based regex that could stop inside
// an arrow-function callback and corrupt page.tsx. We only insert the user
// picker when it is genuinely missing.

if (!src.includes('tokenUserSearch')) {
  const stateMarker = "  const [tokenSearch, setTokenSearch] = useState('');";
  if (!src.includes(stateMarker)) throw new Error('Admin token search state marker is missing');
  src = src.replace(
    stateMarker,
    stateMarker + "\n  const [tokenUserSearch, setTokenUserSearch] = useState('');"
  );

  const selectedUserMarker = "  const selectedUser = users.find(u => (u.uid || u.id) === selectedUid) || null;";
  if (!src.includes(selectedUserMarker)) throw new Error('Admin selected-user marker is missing');

  const helper = [
    '',
    '  const tokenUserMatches = useMemo(() => {',
    '    const q = tokenUserSearch.trim().toLowerCase();',
    '    if (!q) return users.slice(0, 12);',
    '    return users.filter(u => {',
    "      const text = [u.fullName, u.username, u.phone, u.uid, u.id, ...getCategories(u)].filter(Boolean).join(' ').toLowerCase();",
    '      return text.includes(q);',
    '    }).slice(0, 12);',
    '  }, [users, tokenUserSearch]);',
  ].join('\n');
  src = src.replace(selectedUserMarker, selectedUserMarker + helper);

  const tokenTabMarker = "        {tab === 'tokens' && (";
  if (!src.includes(tokenTabMarker)) throw new Error('Admin WilliToken tab is missing');

  const picker = [
    '          <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">',
    '            <div className="flex items-center gap-2">',
    '              <Search size={17} className="text-cyan-300" />',
    '              <div>',
    '                <p className="text-sm font-black">Find user to generate WilliToken</p>',
    '                <p className="text-xs text-slate-400">Search and select the user who should receive the token.</p>',
    '              </div>',
    '            </div>',
    '            <div className="relative mt-3">',
    '              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />',
    '              <input',
    '                value={tokenUserSearch}',
    '                onChange={e => setTokenUserSearch(e.target.value)}',
    '                placeholder="Search user by name, username, phone or UID…"',
    '                className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-9 pr-3 text-sm outline-none focus:border-cyan-400/50"',
    '              />',
    '            </div>',
    '            {tokenUserSearch.trim() && (',
    '              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">',
    '                {tokenUserMatches.length ? tokenUserMatches.map(u => {',
    '                  const id = u.uid || u.id;',
    '                  const selected = selectedUid === id;',
    '                  return (',
    '                    <button',
    '                      key={u.id}',
    '                      type="button"',
    "                      onClick={() => { setSelectedUid(id); setTokenUserSearch(u.fullName || (u.username ? '@' + u.username : id)); }}",
    "                      className={'w-full rounded-xl border p-3 text-left transition ' + (selected ? 'border-cyan-300 bg-cyan-400/15 ring-1 ring-cyan-300/50' : 'border-white/10 bg-white/5 hover:bg-white/10')}",
    '                    >',
    '                      <div className="flex items-center justify-between gap-3">',
    '                        <div>',
    "                          <p className=\"font-black\">{u.fullName || 'Unnamed user'}</p>",
    "                          <p className=\"text-xs text-slate-400\">{u.username ? '@' + u.username : id}</p>",
    '                        </div>',
    '                        {selected && <Check size={18} className="text-cyan-300" />}',
    '                      </div>',
    '                    </button>',
    '                  );',
    '                }) : <p className="p-3 text-sm text-slate-400">No matching users found.</p>}',
    '              </div>',
    '            )}',
    '            {selectedUser && <p className="mt-3 text-xs font-bold text-cyan-200">Selected: {selectedUser.fullName || selectedUser.username || selectedUser.uid || selectedUser.id}</p>}',
    '          </div>',
    '',
  ].join('\n');

  src = src.replace(tokenTabMarker, tokenTabMarker + '\n' + picker);
}

// Validation only. No source rewriting beyond the user-picker insertion above.
const required = [
  ['WilliToken tab', src.includes("tab === 'tokens'")],
  ['category-aware token selection', src.includes('tokenCategories') && src.includes('selectedCategories')],
  ['token category linkage', src.includes('categories:') || src.includes('categories,')],
  ['user picker state', src.includes('tokenUserSearch')],
  ['user picker matching', src.includes('tokenUserMatches')],
  ['user picker UI', src.includes('Find user to generate WilliToken')],
  ['selected user', src.includes('selectedUser')],
];
for (const [name, ok] of required) {
  if (!ok) throw new Error(`Admin ${name} is missing`);
}

fs.writeFileSync(file, src);
console.log('Admin WilliToken user picker verified/installed safely. Existing app/admin/page.tsx logic was not rewritten.');
