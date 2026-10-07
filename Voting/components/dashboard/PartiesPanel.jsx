'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, ImagePlus, Loader2, Pencil, Trash2, X } from 'lucide-react';
import PartySymbol from '@/components/PartySymbol';
import { FieldInput, Toast, Spinner, SectionTitle, primaryBtn, secondaryBtn, uploadImage, postJson, getJson } from './ui';

export function useParties() {
  return useQuery({
    queryKey: ['parties'],
    queryFn: async () => (await getJson('/api/parties')).parties || [],
  });
}

/**
 * Parties are stored once with one symbol. Candidates pick a party from a
 * dropdown and reuse the symbol — nobody uploads the same image twice.
 */
export default function PartiesPanel() {
  const queryClient = useQueryClient();
  const { data: parties = [], isLoading } = useParties();
  const [form, setForm] = useState({ code: '', name: '', manifesto: '', allowMultiplePerSeat: false });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(null);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    setFile(null);
    setPreview('');
  };

  const addParty = async () => {
    setMsg(null);
    if (!form.code.trim() || !form.name.trim()) {
      setMsg({ type: 'error', text: 'Give the party a short code and a name.' });
      return;
    }
    if (!file) {
      setMsg({ type: 'error', text: 'Upload the party symbol image.' });
      return;
    }
    setSaving(true);
    try {
      const symbol = await uploadImage(file, 'party-symbols');
      await postJson('/api/parties', { ...form, symbol });
      setMsg({ type: 'success', text: `${form.name} added. Its symbol will appear on every ballot it stands in.` });
      setForm({ code: '', name: '', manifesto: '', allowMultiplePerSeat: false });
      clearFile();
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const replaceSymbol = async (party, f) => {
    if (!f) return;
    setSaving(true);
    setMsg(null);
    try {
      const symbol = await uploadImage(f, 'party-symbols');
      await postJson(`/api/parties/${encodeURIComponent(party.code)}`, { symbol }, 'PATCH');
      setMsg({ type: 'success', text: `Symbol updated for ${party.name}.` });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  const removeParty = async (party) => {
    if (!window.confirm(`Remove ${party.name}? This only works if no candidate uses it.`)) return;
    setMsg(null);
    try {
      const r = await fetch(`/api/parties/${encodeURIComponent(party.code)}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: `${party.name} removed.` });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Flag}
        title="Parties"
        help="Add each party once with its symbol. Candidates in every village, city, district and state then pick it from a list."
      />

      <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
        <h5 className="text-xs font-semibold text-body uppercase tracking-wider">Add a party</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldInput label="Short code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="INC, BJP, IND…" maxLength={12} help="Used in CSV files." />
          <FieldInput label="Party name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full party name" />
        </div>
        <FieldInput label="Party manifesto / Core platform (optional)" value={form.manifesto} onChange={(e) => setForm((f) => ({ ...f, manifesto: e.target.value }))} placeholder="Key policy pledges, core vision, or principles of the party…" maxLength={500} help="Summary manifesto shared across candidates of this party." />
        <div className="flex flex-wrap items-center gap-4">
          {preview ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-hairline bg-white">
              <img src={preview} alt="Symbol preview" className="w-full h-full object-contain" />
              <button type="button" onClick={clearFile} className="absolute top-1 right-1 bg-ink/75 hover:bg-ink rounded-full p-0.5 text-white transition cursor-pointer" aria-label="Remove image">
                <X size={10} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer bg-canvas border border-dashed border-hairline hover:border-primary rounded-lg px-4 py-3 text-sm text-body transition">
              <ImagePlus size={16} className="text-primary" />
              <span>Upload symbol</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={pickFile} />
            </label>
          )}
          <span className="text-xs text-muted">PNG, SVG, or JPEG · max 5 MB · shown large on the ballot</span>
          <label className="ml-auto flex items-center gap-2 text-xs text-body cursor-pointer">
            <input type="checkbox" checked={form.allowMultiplePerSeat} onChange={(e) => setForm((f) => ({ ...f, allowMultiplePerSeat: e.target.checked }))} />
            Independents (many candidates per seat allowed)
          </label>
        </div>
        {msg && <Toast type={msg.type} msg={msg.text} />}
        <button type="button" onClick={addParty} disabled={saving} className={primaryBtn}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Flag size={14} /> Add party</>}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : parties.length === 0 ? (
        <div className="text-center py-10 text-body text-sm border border-dashed border-hairline rounded-xl bg-canvas">
          No parties yet. Add the parties standing in your elections, with their symbols.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {parties.map((p) => (
            <div key={p.code} className="bg-surface-soft border border-hairline rounded-xl p-4 flex items-start gap-3">
              <PartySymbol symbol={p.symbol} name={p.name} size="lg" className="!w-14 !h-14 bg-white shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-ink font-semibold text-sm truncate">{p.name}</p>
                <p className="text-body text-xs font-mono">{p.code}{p.allowMultiplePerSeat ? ' · independents' : ''}</p>
                {p.manifesto && (
                  <p className="text-muted text-[11px] line-clamp-2 mt-1 italic leading-tight">
                    “{p.manifesto}”
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <label className={`${secondaryBtn} !px-2 !py-1.5`} title="Replace symbol">
                  {editing === p.code && saving ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { setEditing(p.code); replaceSymbol(p, e.target.files?.[0]); }} />
                </label>
                <button type="button" onClick={() => removeParty(p)} className={`${secondaryBtn} !px-2 !py-1.5 hover:text-semantic-down`} title="Remove party">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
