'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MessageActions } from '@/components/community/MessageActions';
import { Check, Paperclip, Search, Settings, ArrowLeft, Lock, Unlock, Users, Send, Image as ImageIcon } from 'lucide-react';

const BASE = '/eduwills';
const rules = ['Be respectful to other members.', 'No spam or harmful content.', 'Keep discussions relevant to the group.'];

const active = (path: string, current: string) => path === current || (path !== BASE && current.startsWith(path));

export default function Group() {
  const params = useParams();
  const router = useRouter();
  const groupId = String((params as any)?.id || (params as any)?.groupId || '');

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [settings, setSettings] = useState(false);
  const [info, setInfo] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState<any>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    return onSnapshot(doc(db, 'communityGroups', groupId), (snap) => {
      setGroup(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !user) return;
    const q = query(collection(db, 'communityGroups', groupId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [groupId, user]);

  useEffect(() => {
    if (!groupId || !user) return;
    const ids = Array.isArray(group?.memberIds) ? group.memberIds : [];
    if (!ids.length) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded: any[] = [];
      for (const id of ids) {
        const snap = await getDoc(doc(db, 'users', id));
        if (snap.exists()) loaded.push({ id: snap.id, ...snap.data() });
      }
      if (!cancelled) setMembers(loaded);
    })();
    return () => { cancelled = true; };
  }, [groupId, user, group?.memberIds]);

  const isMember = !!user && Array.isArray(group?.memberIds) && group.memberIds.includes(user.uid);
  const isAdmin = !!user && (group?.adminIds || []).includes(user.uid);
  const isOwner = !!user && group?.ownerId === user.uid;

  const joinGroup = async () => {
    if (!user || !groupId || !group) return;
    const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
    if (!memberIds.includes(user.uid)) {
      await updateDoc(doc(db, 'communityGroups', groupId), { memberIds: [...memberIds, user.uid] });
    }
  };

  const acknowledge = () => setOnboarding(false);

  const save = async () => {
    if (!isAdmin || !groupId) return;
    setNotice('Settings saved.');
    setSettings(false);
  };

  const send = async () => {
    if (!user || !groupId || !isMember || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    await addDoc(collection(db, 'communityGroups', groupId, 'messages'), {
      text,
      senderId: user.uid,
      senderName: profile?.displayName || profile?.name || user.displayName || 'User',
      createdAt: serverTimestamp(),
      replyTo: reply ? { id: reply.id, text: reply.text || '', senderName: reply.senderName || '' } : null,
    });
    setReply(null);
  };

  const addByUsername = async () => {};
  const remove = async () => {
    if (!isOwner || !groupId) return;
    await deleteDoc(doc(db, 'communityGroups', groupId));
    router.push(`${BASE}/dashboard/community`);
  };

  if (loading) return <main className="min-h-screen grid place-items-center">Loading…</main>;
  if (!group) return <main className="min-h-screen grid place-items-center p-6">Group unavailable.</main>;

  if (!user) {
    return <main className="min-h-screen grid place-items-center p-6 text-center">Please sign in to view this group.</main>;
  }

  if (!isMember) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <button className="mb-4 inline-flex items-center gap-2 text-sm" onClick={() => router.back()}><ArrowLeft size={16} /> Back</button>
          <h1 className="text-2xl font-bold">{group.name || 'Group'}</h1>
          <p className="mt-2 text-slate-600">Join this group to view and participate in its chat.</p>
          <button className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white" onClick={joinGroup}>Join group</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl py-4">
        <div className="mx-3 mb-3 flex items-center justify-between gap-3 sm:mx-0">
          <button className="inline-flex items-center gap-2 text-sm" onClick={() => router.back()}><ArrowLeft size={16} /> Back</button>
          <div className="flex items-center gap-2">
            {isAdmin && <button className="rounded-xl border bg-white p-2" onClick={() => setSettings(true)} aria-label="Settings"><Settings size={18} /></button>}
            <button className="rounded-xl border bg-white p-2" onClick={() => setInfo(true)} aria-label="Group info"><Users size={18} /></button>
          </div>
        </div>

        <section className="mx-3 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mx-0">
          <div className="p-5">
            <h1 className="text-xl font-bold">{group.name || 'Group'}</h1>
            <p className="mt-1 text-sm text-slate-600">{group.description || 'Community group'}</p>
          </div>
        </section>

        {notice && <div className="mx-3 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:mx-0">{notice}</div>}

        <section className="mx-3 mb-3 rounded-2xl border border-slate-200 bg-white shadow-sm sm:mx-0">
          <div className="h-[55vh] min-h-[360px] space-y-3 overflow-y-auto p-3 sm:p-5">
            {messages.length ? (
              messages.map((m) => (
                <div key={m.id} className={'flex gap-2 ' + (m.senderId === user.uid ? 'justify-end' : '')}>
                  <div className={'max-w-[86%] ' + (m.senderId === user.uid ? 'items-end' : 'items-start')}>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3">
                      <div className="mb-1 text-xs font-semibold text-slate-500">{m.senderName || 'User'}</div>
                      {m.replyTo && <div className="mb-2 rounded-lg border-l-2 border-slate-300 bg-white/70 px-2 py-1 text-xs text-slate-500">{m.replyTo.text}</div>}
                      {m.imageUrl && <img src={m.imageUrl} alt="Attached image" className="mb-2 max-h-72 rounded-xl object-contain" />}
                      {m.text && <div className="whitespace-pre-wrap break-words text-sm">{m.text}</div>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ''}</span>
                      <button onClick={() => setReply(m)} className="hover:text-slate-700">Reply</button>
                      <MessageActions message={m} groupId={groupId} canDelete={isAdmin || m.senderId === user.uid} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-slate-100"><Send size={20} /></div>
                  <p className="font-semibold">No messages yet</p>
                  <p className="mt-1 text-sm text-slate-500">Start the conversation.</p>
                </div>
              </div>
            )}
          </div>

          {reply && (
            <div className="mx-3 mb-2 flex items-center justify-between rounded-xl bg-slate-100 p-3 text-sm sm:mx-5">
              <div className="min-w-0"><div className="font-semibold">Replying to {reply.senderName || 'User'}</div><div className="truncate text-slate-500">{reply.text || 'Message'}</div></div>
              <button onClick={() => setReply(null)} className="ml-3 text-slate-500">Cancel</button>
            </div>
          )}

          {image && (
            <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-slate-100 p-3 sm:mx-5">
              <img src={image} alt="Selected upload" className="h-16 w-16 rounded-lg object-cover" />
              <span className="text-sm text-slate-500">Image selected</span>
              <button onClick={() => setImage(null)} className="ml-auto text-sm">Remove</button>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-slate-200 p-3 sm:p-5">
            <label className="cursor-pointer rounded-xl border bg-white p-3" aria-label="Attach image">
              <ImageIcon size={18} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result || ''));
                reader.readAsDataURL(file);
              }} />
            </label>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none" />
            <button onClick={() => void send()} disabled={!draft.trim()} className="rounded-xl bg-slate-900 p-3 text-white disabled:opacity-40" aria-label="Send"><Send size={18} /></button>
          </div>
        </section>

        {info && (
          <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={() => setInfo(false)}>
            <aside className="mx-auto mt-16 max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold">Group information</h2>
              <p className="mt-2 text-sm text-slate-600">{members.length} member{members.length === 1 ? '' : 's'}</p>
              <ul className="mt-4 space-y-2">{members.map((m) => <li key={m.id} className="rounded-lg bg-slate-50 p-2 text-sm">{m.displayName || m.name || m.username || 'User'}</li>)}</ul>
            </aside>
          </div>
        )}

        {isAdmin && settings && (
          <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={() => setSettings(false)}>
            <aside className="mx-auto mt-16 max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold">Group settings</h2>
              <div className="mt-4 space-y-2">{rules.map((rule) => <div key={rule} className="flex items-center gap-2 text-sm"><Check size={16} />{rule}</div>)}</div>
              <button onClick={() => void save()} className="mt-5 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">Save</button>
              {isOwner && <button onClick={() => void remove()} className="ml-2 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-600">Delete group</button>}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
