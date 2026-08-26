from pathlib import Path

path = Path('app/admin/page.tsx')
src = path.read_text(encoding='utf-8')

# This build-time patch is deliberately exact and idempotent. It never serializes
# JSX through JavaScript strings, which prevents escaped JSX such as "\\<main".
if 'tokenUserSearch' not in src:
    state = "  const [tokenSearch, setTokenSearch] = useState('');"
    assert state in src, 'Admin token search state marker not found'
    src = src.replace(state, state + "\n  const [tokenUserSearch, setTokenUserSearch] = useState('');", 1)

    selected = "  const selectedUser = users.find(u => (u.uid || u.id) === selectedUid) || null;"
    assert selected in src, 'Admin selected-user marker not found'
    helper = '''\n  const tokenUserMatches = useMemo(() => {\n    const q = tokenUserSearch.trim().toLowerCase();\n    if (!q) return users.slice(0, 12);\n    return users.filter(u => {\n      const text = [u.fullName, u.username, u.phone, u.uid, u.id, ...getCategories(u)].filter(Boolean).join(' ').toLowerCase();\n      return text.includes(q);\n    }).slice(0, 12);\n  }, [users, tokenUserSearch]);\n'''
    src = src.replace(selected, selected + helper, 1)

    token_section = "              <label className=\"mt-5 block text-xs font-black uppercase text-slate-400\">User</label>\n              <select value={selectedUid} onChange={e => setSelectedUid(e.target.value)} className=\"mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold\"><option value=\"\">Select user…</option>{users.map(u => <option key={u.id} value={u.uid || u.id}>{u.fullName || u.username || u.id}</option>)}</select>"
    assert token_section in src, 'Admin token user selector marker not found'
    picker = '''              <label className="mt-5 block text-xs font-black uppercase text-slate-400">Find user to generate WilliToken</label>\n              <div className="relative mt-2">\n                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />\n                <input value={tokenUserSearch} onChange={e => setTokenUserSearch(e.target.value)} placeholder="Search name, username, phone or UID…" className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-9 pr-3 text-sm outline-none focus:border-cyan-300/50" />\n              </div>\n              {tokenUserSearch.trim() && (\n                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">\n                  {tokenUserMatches.length ? tokenUserMatches.map(u => {\n                    const id = u.uid || u.id;\n                    const selected = selectedUid === id;\n                    return (\n                      <button key={u.id} type="button" onClick={() => { setSelectedUid(id); setTokenUserSearch(u.fullName || (u.username ? '@' + u.username : id)); }} className={'w-full rounded-xl border p-3 text-left transition ' + (selected ? 'border-cyan-300 bg-cyan-400/15 ring-1 ring-cyan-300/50' : 'border-white/10 bg-slate-900 hover:bg-white/10')}>\n                        <div className="flex items-center justify-between gap-3">\n                          <div><p className="font-black">{u.fullName || 'Unnamed user'}</p><p className="text-xs text-slate-400">{u.username ? '@' + u.username : id}</p></div>\n                          {selected && <Check size={17} className="text-cyan-300" />}\n                        </div>\n                      </button>\n                    );\n                  }) : <p className="p-3 text-sm text-slate-400">No matching users found.</p>}\n                </div>\n              )}\n              {selectedUser && <p className="mt-2 text-xs font-bold text-cyan-200">Selected: {selectedUser.fullName || selectedUser.username || selectedUser.uid || selectedUser.id}</p>}\n\n              <label className="mt-4 block text-xs font-black uppercase text-slate-400">User</label>\n              <select value={selectedUid} onChange={e => setSelectedUid(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold"><option value="">Select user…</option>{users.map(u => <option key={u.id} value={u.uid || u.id}>{u.fullName || u.username || u.id}</option>)}</select>'''
    src = src.replace(token_section, picker, 1)

# Add deterministic expiry cleanup to the existing loader.
if 'expiredTokenDocs' not in src:
    loader = "      setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));"
    if loader not in src:
        raise SystemExit('Admin token loader marker not found')
    cleanup = '''      const allTokenDocs = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));\n      const nowMs = Date.now();\n      const expiredTokenDocs = allTokenDocs.filter(x => { const e = expiryDate(x); return !!e && e.getTime() <= nowMs; });\n      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));\n      const liveTokenDocs = allTokenDocs.filter(x => { const e = expiryDate(x); return !!e && e.getTime() > nowMs; });\n      setTokens(liveTokenDocs);'''
    src = src.replace(loader, cleanup, 1)

# Refuse to write malformed escaped JSX.
if '\\<main' in src or '\\:px-' in src or '\\:py-' in src:
    raise SystemExit('Refusing to write Admin source containing escaped JSX/Tailwind punctuation')

path.write_text(src, encoding='utf-8')
print('Admin WilliToken user-picker and expiry cleanup applied safely.')
