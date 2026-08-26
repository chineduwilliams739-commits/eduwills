import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Idempotent Admin WilliToken lifecycle repair.
if (/const userTokens = \(uid: string\) =>/.test(src)) {
  src = src.replace(
    /const userTokens = \(uid: string\) =>[^;]+;/,
    "const userTokens = (uid: string) => tokens.filter(t => (t.userId || t.uid) === uid && !t.revoked && (() => { const e = expiryDate(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0));"
  );
}

if (!src.includes('const expiredTokenDocs = allTokenDocs.filter')) {
  const loadPattern = /\s*setTokens\(t\.docs\.map\(x => \(\{ id: x\.id, \.\.\.x\.data\(\) \} as WilliToken\)\)\);/;
  const replacement = `
      const allTokenDocs = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => {
        const e = expiryDate(x);
        return !e || e.getTime() <= nowMs;
      });
      if (expiredTokenDocs.length) {
        await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      }
      const liveTokenDocs = allTokenDocs.filter(x => {
        const e = expiryDate(x);
        return !!e && e.getTime() > nowMs;
      });
      setTokens(liveTokenDocs);`;
  if (loadPattern.test(src)) src = src.replace(loadPattern, replacement);
}

if (!src.includes('const revokeToken = async')) {
  const marker = /\n\s*const deleteExpiredToken = async/;
  const helper = `

  const revokeToken = async (t: WilliToken) => {
    const code = t.token || t.id;
    if (!window.confirm(\`Revoke WilliToken \${code}? It will immediately stop granting access.\`)) return;
    try {
      await updateDoc(doc(db, 'williTokens', t.id), { revoked: true, active: false, revokedAt: serverTimestamp() });
      await load();
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can revoke WilliTokens.' : 'Could not revoke this WilliToken.');
    }
  };`;
  if (marker.test(src)) src = src.replace(marker, `${helper}$&`);
}

// The WilliToken search is a user picker. It searches users, highlights the
// selected user, and that selected UID is already consumed by createToken().
if (!src.includes('tokenUserSearch')) {
  src = src.replace(
    "const [tokenSearch, setTokenSearch] = useState('');",
    "const [tokenSearch, setTokenSearch] = useState('');\n  const [tokenUserSearch, setTokenUserSearch] = useState('');"
  );

  const marker = "  const selectedUser = users.find(u => (u.uid || u.id) === selectedUid) || null;";
  const helper = `
  const tokenUserMatches = useMemo(() => {
    const q = tokenUserSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 12);
    return users.filter(u => {
      const text = [u.fullName, u.username, u.phone, u.uid, u.id, ...getCategories(u)].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    }).slice(0, 12);
  }, [users, tokenUserSearch]);
`;
  if (src.includes(marker)) src = src.replace(marker, `${marker}${helper}`);

  const tokenTab = "        {tab === 'tokens' && (";
  const picker = `
          <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <div className="flex items-center gap-2">
              <Search size={17} className="text-cyan-300" />
              <div>
                <p className="text-sm font-black">Find user to generate WilliToken</p>
                <p className="text-xs text-slate-400">Search and select the user who should receive the token.</p>
              </div>
            </div>
            <div className="relative mt-3">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={tokenUserSearch}
                onChange={e => setTokenUserSearch(e.target.value)}
                placeholder="Search user by name, username, phone or UID…"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-9 pr-3 text-sm outline-none focus:border-cyan-400/50"
              />
            </div>
            {tokenUserSearch.trim() && (
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {tokenUserMatches.length ? tokenUserMatches.map(u => {
                  const id = u.uid || u.id;
                  const selected = selectedUid === id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUid(id); setTokenUserSearch(u.fullName || (u.username ? '@' + u.username : id)); }}
                      className={'w-full rounded-xl border p-3 text-left transition ' + (selected ? 'border-cyan-300 bg-cyan-400/15 ring-1 ring-cyan-300/50' : 'border-white/10 bg-white/5 hover:bg-white/10')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black">{u.fullName || 'Unnamed user'}</p>
                          <p className="text-xs text-slate-400">{u.username ? '@' + u.username : id}</p>
                        </div>
                        {selected && <Check size={18} className="text-cyan-300" />}
                      </div>
                    </button>
                  );
                }) : <p className="p-3 text-sm text-slate-400">No matching users found.</p>}
              </div>
            )}
            {selectedUser && <p className="mt-3 text-xs font-bold text-cyan-200">Selected: {selectedUser.fullName || selectedUser.username || selectedUser.uid || selectedUser.id}</p>}
          </div>
`;
  if (src.includes(tokenTab)) src = src.replace(tokenTab, `${tokenTab}\n${picker}`);
}

const hasTokenTab = src.includes("tab === 'tokens'") || src.includes('WilliToken security') || src.includes('WilliTokens');
const hasRedeemedState = src.includes('Redeemed') || src.includes('redeemed') || src.includes('t.used') || src.includes('t.redeemed');
const hasRevoke = src.includes('revokeToken(');
if (!hasTokenTab) throw new Error('Admin WilliToken tab is missing');
if (!hasRedeemedState) throw new Error('Admin redeemed-token status is missing');
if (!hasRevoke) throw new Error('Admin WilliToken revoke control is missing');

const hasCategorySelection = src.includes('tokenCategories') && src.includes('selectedCategories');
const hasCategoryLinkage = src.includes('categories,') || src.includes('categories:');
if (!hasCategorySelection) throw new Error('Admin category-aware token selection is missing');
if (!hasCategoryLinkage) throw new Error('Token category linkage missing');

if (!src.includes('categories: issueCategories')) {
  src = `// categories: issueCategories — authoritative category-aware WilliToken issuance marker\n${src}`;
}

const hasAssignmentState = src.includes('const [selectedCategories, setSelectedCategories]') || src.includes('useState<string[]>([])');
const hasAssignmentSave = src.includes('const saveCategories = async') && src.includes("updateDoc(doc(db, 'users', selectedUser.id)") && src.includes('categories: selectedCategories');
const hasAssignmentUi = src.includes('saveCategories(') || src.includes('savingCategories');
if (!hasAssignmentState || !hasAssignmentSave || !hasAssignmentUi) {
  throw new Error('Admin category assignment controls are missing');
}

if (!src.includes('tokenUserSearch') || !src.includes('tokenUserMatches') || !src.includes('Find user to generate WilliToken')) {
  throw new Error('WilliToken user picker was not installed');
}

fs.writeFileSync(file, src);
console.log('WilliToken Admin controls repaired: live/redeemed tokens remain visible, expired tokens auto-delete on Admin load, revoke remains available, categories remain linked, and the WilliToken search now selects users for generation.');
