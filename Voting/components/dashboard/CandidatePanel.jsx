'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Download, Loader2, Upload, UserPlus, Trash2 } from 'lucide-react';
import PartySymbol from '@/components/PartySymbol';
import { FieldInput, FieldSelect, Toast, Spinner, SectionTitle, Pill, primaryBtn, secondaryBtn, inputClass, postJson, getJson } from './ui';
import { useParties } from './PartiesPanel';
import { useSeats } from './SeatsPanel';

/**
 * Add a candidate: pick the party from the list (symbol comes with it) and,
 * for seat-based elections, the seat they stand in. The same party can field
 * a different person in every seat.
 */
export default function CandidatePanel({ slug, electionId, level, canEdit }) {
  const queryClient = useQueryClient();
  const filtered = level && level !== 'general';
  const [form, setForm] = useState({ name: '', partyId: '', constituencyCode: '', manifesto: '' });
  const [seatFilter, setSeatFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const { data: parties = [] } = useParties();
  const { data: seats = [] } = useSeats(filtered ? level : '');
  const states = useMemo(() => [...new Set(seats.map((s) => s.state).filter(Boolean))].sort(), [seats]);
  const seatsForState = useMemo(() => seats.filter((s) => !stateFilter || s.state === stateFilter), [seats, stateFilter]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates', slug, electionId],
    queryFn: async () => (await getJson(`/api/org/${slug}/elections/${electionId}/candidates`)).candidates || [],
    enabled: !!slug && electionId != null,
  });

  const addMutation = useMutation({
    mutationFn: (payload) => postJson(`/api/org/${slug}/elections/${electionId}/candidates`, payload),
    onSuccess: () => {
      const party = parties.find((p) => p._id === form.partyId);
      setMsg({ type: 'success', text: `${form.name} added for ${party?.name || 'the party'}${form.constituencyCode ? ` in ${seats.find((s) => s.code === form.constituencyCode)?.name || form.constituencyCode}` : ''}.` });
      setForm((f) => ({ ...f, name: '', manifesto: '' }));
      queryClient.invalidateQueries({ queryKey: ['candidates', slug, electionId] });
      queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist', electionId] });
    },
    onError: (e) => setMsg({ type: 'error', text: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (cand) => {
      const idQuery = cand._id ? `&id=${cand._id}` : '';
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates?candidateId=${cand.candidateId ?? cand.id ?? 0}${idQuery}`, {
        method: 'DELETE',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to remove candidate');
      return d;
    },
    onSuccess: () => {
      setMsg({ type: 'success', text: 'Candidate removed successfully.' });
      queryClient.invalidateQueries({ queryKey: ['candidates', slug, electionId] });
      queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist', electionId] });
    },
    onError: (e) => setMsg({ type: 'error', text: e.message }),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates?all=true`, {
        method: 'DELETE',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to clear candidates');
      return d;
    },
    onSuccess: () => {
      setMsg({ type: 'success', text: 'All candidates cleared.' });
      queryClient.invalidateQueries({ queryKey: ['candidates', slug, electionId] });
      queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist', electionId] });
    },
    onError: (e) => setMsg({ type: 'error', text: e.message }),
  });

  const handleAdd = () => {
    setMsg(null);
    if (!form.name.trim()) return setMsg({ type: 'error', text: 'Enter the candidate name.' });
    if (!form.partyId) return setMsg({ type: 'error', text: 'Choose a party from the list.' });
    if (filtered && !form.constituencyCode) return setMsg({ type: 'error', text: 'Choose the seat this candidate stands in.' });
    addMutation.mutate({ name: form.name.trim(), partyId: form.partyId, constituencyCode: form.constituencyCode, manifesto: form.manifesto });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
    disabled: !canEdit,
    onDropAccepted: async (files) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setMsg(null);
      setUploadResult(null);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates/upload-csv`, { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setUploadResult(d);
        setMsg({ type: 'success', text: `${d.added} candidate(s) added${d.errors?.length ? `, ${d.errors.length} row(s) skipped` : ''}.` });
        queryClient.invalidateQueries({ queryKey: ['candidates', slug, electionId] });
        queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] });
        queryClient.invalidateQueries({ queryKey: ['checklist', electionId] });
      } catch (e) {
        setMsg({ type: 'error', text: e.message });
      } finally {
        setUploading(false);
      }
    },
  });

  const visibleCandidates = seatFilter ? candidates.filter((c) => c.constituencyCode === seatFilter) : candidates;
  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of visibleCandidates) {
      const key = c.constituencyCode || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return [...map.entries()];
  }, [visibleCandidates]);
  const seatName = (code) => seats.find((s) => s.code === code)?.name || code;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={UserPlus}
        title="Candidates"
        help={filtered ? 'One candidate per party per seat. Pick the party (the symbol comes with it) and the seat.' : 'Pick the party from the list — its symbol is used automatically.'}
        right={canEdit && <a href={`/api/org/${slug}/elections/${electionId}/candidates/template`} download className={secondaryBtn}><Download size={12} /> CSV template</a>}
      />

      {canEdit && (
        <>
          {parties.length === 0 && (
            <Toast type="error" msg="No parties yet. Add parties with their symbols in the Parties tab first." />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput label="Candidate name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            <FieldSelect label="Party" value={form.partyId} onChange={(e) => setForm((f) => ({ ...f, partyId: e.target.value }))}>
              <option value="">Choose a party…</option>
              {parties.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}
            </FieldSelect>
            {filtered && (
              <>
                <FieldSelect label="State" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setForm((f) => ({ ...f, constituencyCode: '' })); }}>
                  <option value="">All states</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </FieldSelect>
                <FieldSelect label="Seat" value={form.constituencyCode} onChange={(e) => setForm((f) => ({ ...f, constituencyCode: e.target.value }))} help={seats.length === 0 ? 'Add seats of this type in the Seats tab first.' : ''}>
                  <option value="">Choose the seat…</option>
                  {seatsForState.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} — {[s.ward && `Ward ${s.ward}`, s.village || s.city, s.district].filter(Boolean).join(', ') || s.state} ({s.code})
                    </option>
                  ))}
                </FieldSelect>
              </>
            )}
            <div className="md:col-span-2">
              <FieldInput label="Promises (optional)" value={form.manifesto} onChange={(e) => setForm((f) => ({ ...f, manifesto: e.target.value }))} placeholder="What this candidate stands for…" multiline />
            </div>
          </div>
          {form.partyId && (
            <div className="flex items-center gap-3 text-sm text-body">
              <PartySymbol symbol={parties.find((p) => p._id === form.partyId)?.symbol} name={parties.find((p) => p._id === form.partyId)?.name} size="lg" className="bg-white" />
              This symbol will be shown next to the candidate on every ballot.
            </div>
          )}
          {msg && <Toast type={msg.type} msg={msg.text} />}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleAdd} disabled={addMutation.isPending || parties.length === 0} className={primaryBtn}>
              {addMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : <><UserPlus size={14} /> Add candidate</>}
            </button>
            <div {...getRootProps()} className={`flex-1 min-w-[240px] border-2 border-dashed rounded-lg px-4 py-3 text-center cursor-pointer transition text-xs text-body ${isDragActive ? 'border-primary bg-primary/5' : 'border-hairline hover:border-primary/40'}`}>
              <input {...getInputProps()} />
              {uploading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin text-primary" /> Adding candidates on-chain…</span> : <span className="inline-flex items-center gap-2"><Upload size={14} className="text-muted" /> Or drop a CSV: constituencyCode, name, partyCode, manifesto</span>}
            </div>
          </div>
          {uploadResult?.errors?.length > 0 && (
            <div className="bg-surface-soft border border-hairline rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-ink text-xs mb-1 font-semibold">Rows skipped ({uploadResult.errors.length}):</p>
              {uploadResult.errors.map((err, i) => <p key={i} className="text-semantic-down text-xs py-0.5">Row {err.row} · {err.name} — {err.reason}</p>)}
            </div>
          )}
        </>
      )}

      {!canEdit && msg && <Toast type={msg.type} msg={msg.text} />}

      {isLoading ? (
        <Spinner />
      ) : candidates.length > 0 ? (
        <div className="border-t border-hairline pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h5 className="text-xs font-semibold text-body uppercase tracking-wider">On the ballot</h5>
              <Pill>{candidates.length} candidate{candidates.length === 1 ? '' : 's'}</Pill>
              {filtered && (
                <select value={seatFilter} onChange={(e) => setSeatFilter(e.target.value)} className={`${inputClass} !w-auto !py-1.5 !text-xs`}>
                  <option value="">All seats</option>
                  {[...new Set(candidates.map((c) => c.constituencyCode).filter(Boolean))].map((code) => <option key={code} value={code}>{seatName(code)}</option>)}
                </select>
              )}
            </div>
            {canEdit && candidates.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove all ${candidates.length} candidates from this election?`)) {
                    clearAllMutation.mutate();
                  }
                }}
                disabled={clearAllMutation.isPending}
                className="text-xs text-semantic-down hover:underline inline-flex items-center gap-1 font-medium"
              >
                <Trash2 size={12} /> Clear all
              </button>
            )}
          </div>
          {grouped.map(([code, list]) => (
            <div key={code || 'all'} className="space-y-2">
              {filtered && <p className="text-sm font-semibold text-ink">{seatName(code) || 'No seat'} <span className="text-muted font-mono text-xs">{code}</span></p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((c) => (
                  <div key={c.id ?? c._id} className="bg-surface-soft border border-hairline rounded-lg p-3.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <PartySymbol symbol={c.symbol} name={c.party} size="lg" className="bg-white shrink-0" />
                      <div className="min-w-0">
                        <p className="text-ink font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-body text-xs truncate">{c.party}</p>
                        {c.manifesto && <p className="text-muted text-[11px] truncate max-w-[200px]" title={c.manifesto}>{c.manifesto}</p>}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        title="Remove candidate"
                        onClick={() => {
                          if (confirm(`Remove candidate "${c.name}"?`)) {
                            deleteMutation.mutate(c);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted hover:text-semantic-down transition shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No candidates yet.</p>
      )}
    </div>
  );
}
