'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Download, FileSpreadsheet, Loader2, Search, ShieldAlert, Upload, UserPlus, Users, Trash2, AlertTriangle } from 'lucide-react';
import { FieldInput, Toast, Spinner, SectionTitle, Pill, primaryBtn, secondaryBtn, inputClass, postJson, getJson } from './ui';

const COLUMNS = 'voterId, name, email, phone, gender, age, state, district, city, village, ward, partNo, homePollingStation, assemblyConstituency, parliamentaryConstituency';

/**
 * The master electoral roll: one row per person with their home address and
 * seats. Uploaded once; elections then "include" people from it by place.
 */
export default function RollPanel() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ voterId: '', name: '', email: '', phone: '', gender: '', age: '', state: '', district: '', city: '', village: '', ward: '', partNo: '', homePollingStation: '', assemblyConstituency: '', parliamentaryConstituency: '' });

  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (search) params.set('q', search);
  if (state) params.set('state', state);

  const { data, isLoading } = useQuery({
    queryKey: ['roll', search, state, page],
    queryFn: () => getJson(`/api/voters/roll?${params.toString()}`),
  });

  const voters = data?.voters || [];
  const states = data?.states || [];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv'], 'application/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
    onDropAccepted: async (files) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setMsg(null);
      setResult(null);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await fetch('/api/voters/upload-csv', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setResult(d);
        const parts = [
          `${d.added} new ${d.added === 1 ? 'person' : 'people'} added`,
          d.unchanged ? `${d.unchanged} already on the roll (no change)` : '',
          d.casesOpened ? `${d.casesOpened} sent to the guardians (${d.caseBreakdown.duplicate} duplicate, ${d.caseBreakdown.missing} missing details)` : '',
        ].filter(Boolean);
        setMsg({ type: 'success', text: parts.join(' · ') });
        queryClient.invalidateQueries({ queryKey: ['roll'] });
      } catch (e) {
        setMsg({ type: 'error', text: e.message });
      } finally {
        setUploading(false);
      }
    },
  });

  const addOne = async () => {
    setAdding(true);
    setMsg(null);
    try {
      const d = await postJson('/api/voters/roll', { ...form, age: form.age ? Number(form.age) : null });
      if (d.caseOpened) setMsg({ type: 'success', text: d.message });
      else if (d.unchanged) setMsg({ type: 'success', text: 'This person is already on the roll with the same details.' });
      else setMsg({ type: 'success', text: `${form.name} added to the roll.` });
      setForm((f) => ({ ...f, voterId: '', name: '', email: '', phone: '', age: '' }));
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['roll'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setAdding(false);
    }
  };

  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelectAll = () => {
    if (selected.size === voters.length && voters.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(voters.map((v) => v.voterId)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeOne = async (voter) => {
    if (!confirm(`Remove ${voter.name} (${voter.voterId}) from the electoral roll?`)) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/voters/roll?voterId=${encodeURIComponent(voter.voterId)}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: `${voter.name} removed from the roll.` });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(voter.voterId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['roll'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} selected voter(s) from the roll?`)) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voters/roll', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterIds: Array.from(selected) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message || `${selected.size} voter(s) removed.` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['roll'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const removeAll = async () => {
    const totalCount = data?.total || 0;
    if (totalCount === 0) return;
    if (!confirm(`Are you sure you want to remove ALL ${totalCount} voters from the electoral roll? This will unenroll them from elections.`)) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/voters/roll', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message || 'All voters removed from the roll.' });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['roll'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Users}
        title="Voters (master roll)"
        help="Upload the electoral roll once. Each election later includes people by state, district, city, village or seat — nobody is typed in twice."
        right={
          <div className="flex gap-2">
            <a href="/api/voters/template" download className={secondaryBtn}><Download size={12} /> CSV template</a>
            <button type="button" onClick={() => setShowAdd((v) => !v)} className={secondaryBtn}><UserPlus size={12} /> Add one person</button>
          </div>
        }
      />

      {data?.openCases > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 rounded-lg p-3 text-sm">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>{data.openCases}</strong> voter case{data.openCases === 1 ? '' : 's'} waiting for a guardian (duplicates or missing details).
            Those people cannot be enrolled or vote until a guardian decides on the Guardian portal.
          </span>
        </div>
      )}

      <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
        <h5 className="text-xs font-semibold text-body uppercase tracking-wider flex items-center gap-2"><FileSpreadsheet size={14} className="text-primary" /> Import the roll (CSV, up to 50,000 rows)</h5>
        <code className="block bg-surface-soft rounded-lg p-2.5 text-xs text-body font-mono break-words">{COLUMNS}</code>
        <p className="text-xs text-muted">
          Required: voterId, name, email, state and a seat code (or a village / city). Seat codes must exist in the Seats tab.
          Column names like &quot;EPIC&quot;, &quot;Mobile&quot;, &quot;AC No&quot; and &quot;PC&quot; are understood too.
        </p>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${isDragActive ? 'border-primary bg-primary/5' : 'border-hairline hover:border-primary/40'}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-primary" size={24} /><p className="text-body text-sm">Checking every row against the roll…</p></div>
          ) : (
            <div className="flex flex-col items-center gap-2"><Upload size={24} className="text-muted" /><p className="text-body text-sm">{isDragActive ? 'Drop the file here' : 'Drag the roll CSV here, or click to choose'}</p></div>
          )}
        </div>
        {msg && <Toast type={msg.type} msg={msg.text} />}
        {result?.caseSamples?.length > 0 && (
          <div className="bg-surface-soft border border-hairline rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-ink text-xs mb-1 font-semibold">Rows sent to the guardians ({result.casesOpened}):</p>
            {result.caseSamples.map((c, i) => (
              <p key={i} className="text-xs py-0.5 text-body">
                Row {c.row} · <span className="font-mono">{c.voterId}</span> · <span className={c.kind === 'duplicate' ? 'text-amber-700 dark:text-amber-300' : 'text-semantic-down'}>{c.kind}</span> — {c.reason}
              </p>
            ))}
          </div>
        )}
        {result?.ignoredColumns?.length > 0 && (
          <p className="text-xs text-muted">Ignored columns: {result.ignoredColumns.join(', ')}</p>
        )}
      </div>

      {showAdd && (
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
          <h5 className="text-xs font-semibold text-body uppercase tracking-wider">Add one person</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FieldInput label="Voter ID" value={form.voterId} onChange={(e) => setForm((f) => ({ ...f, voterId: e.target.value.toUpperCase() }))} placeholder="ABC1234567" />
            <FieldInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <FieldInput label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <FieldInput label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <FieldInput label="Gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} placeholder="Female" />
            <FieldInput label="Age" type="number" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} />
            <FieldInput label="State" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
            <FieldInput label="District" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
            <FieldInput label="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <FieldInput label="Village" value={form.village} onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))} />
            <FieldInput label="Ward" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} />
            <FieldInput label="Part no." value={form.partNo} onChange={(e) => setForm((f) => ({ ...f, partNo: e.target.value }))} />
            <div className="col-span-2"><FieldInput label="Home polling station" value={form.homePollingStation} onChange={(e) => setForm((f) => ({ ...f, homePollingStation: e.target.value }))} /></div>
            <FieldInput label="Assembly seat code" value={form.assemblyConstituency} onChange={(e) => setForm((f) => ({ ...f, assemblyConstituency: e.target.value.toUpperCase() }))} placeholder="MH-AC-258" />
            <FieldInput label="Lok Sabha seat code" value={form.parliamentaryConstituency} onChange={(e) => setForm((f) => ({ ...f, parliamentaryConstituency: e.target.value.toUpperCase() }))} placeholder="MH-PC-45" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addOne} disabled={adding || !form.voterId || !form.name || !form.email} className={primaryBtn}>
              {adding ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Add to roll'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className={secondaryBtn}>Cancel</button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Voter ID, name or email" className={`${inputClass} !pl-9 !w-72`} />
        </div>
        <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} className={`${inputClass} !w-auto`}>
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit" className={secondaryBtn}>Search</button>
        {data && <Pill>{data.total.toLocaleString()} on the roll</Pill>}
      </form>

      {isLoading ? (
        <Spinner />
      ) : voters.length === 0 ? (
        <div className="text-center py-10 text-body text-sm border border-dashed border-hairline rounded-xl bg-canvas">
          {search || state ? 'Nobody matches this search.' : 'The roll is empty. Import the CSV above.'}
        </div>
      ) : (
        <>
          {selected.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-surface-soft border border-hairline rounded-xl text-xs">
              <span className="text-ink font-medium">{selected.size} voter(s) selected</span>
              <button
                type="button"
                onClick={removeSelected}
                disabled={deleting}
                className={`${secondaryBtn} hover:!text-semantic-down !py-1 !px-2.5 text-xs text-semantic-down`}
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete selected ({selected.size})
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                  <th className="w-8 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={voters.length > 0 && selected.size === voters.length}
                      onChange={toggleSelectAll}
                      className="rounded border-hairline"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">Voter ID</th>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-semibold">Home place</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Seats</th>
                  <th className="text-left px-4 py-3 font-semibold">In elections</th>
                  <th className="text-right px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {voters.map((v) => (
                  <tr key={v.voterId} className={`hover:bg-surface-soft/50 transition ${selected.has(v.voterId) ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(v.voterId)}
                        onChange={() => toggleSelectOne(v.voterId)}
                        className="rounded border-hairline"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink">
                      {v.voterId}
                      {v.hasOpenCase && <span className="ml-2"><Pill tone="warn">Case open</Pill></span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink font-medium">{v.name}</td>
                    <td className="px-4 py-2.5 text-body font-mono text-xs hidden md:table-cell">{v.email}</td>
                    <td className="px-4 py-2.5 text-body text-xs">{[v.ward && `Ward ${v.ward}`, v.village || v.city, v.district, v.state].filter(Boolean).join(', ')}</td>
                    <td className="px-4 py-2.5 text-muted font-mono text-xs hidden lg:table-cell">{[v.assemblyConstituency, v.parliamentaryConstituency].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-2.5 text-body text-xs">{v.elections || 0}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeOne(v)}
                        disabled={deleting}
                        className="p-1.5 text-muted hover:text-semantic-down hover:bg-semantic-down/10 rounded-lg transition inline-flex items-center"
                        title="Remove voter"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="flex items-center justify-between text-xs text-body">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={secondaryBtn}>Previous</button>
              <span>Page {page} of {data.pages}</span>
              <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className={secondaryBtn}>Next</button>
            </div>
          )}

          {/* Remove / Danger Zone Section */}
          <div className="border border-hairline rounded-xl p-4 bg-canvas flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h6 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-500" /> Remove Voters from Master Roll
              </h6>
              <p className="text-xs text-muted mt-0.5">
                Permanently deletes voters, unenrolls them from elections, and clears open guardian cases.
              </p>
            </div>
            <button
              type="button"
              onClick={removeAll}
              disabled={deleting || (data?.total || 0) === 0}
              className={`${secondaryBtn} hover:!text-semantic-down !text-semantic-down text-xs shrink-0`}
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Clear entire roll ({(data?.total || 0).toLocaleString()})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
