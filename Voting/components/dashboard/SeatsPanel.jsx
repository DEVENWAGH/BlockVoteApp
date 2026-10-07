'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Download, Loader2, MapPinned, Upload } from 'lucide-react';
import { FieldInput, FieldSelect, Toast, Spinner, SectionTitle, Pill, primaryBtn, secondaryBtn, postJson, getJson, inputClass } from './ui';

const SEAT_LEVELS = [
  { value: 'loksabha', label: 'Lok Sabha (MP)' },
  { value: 'assembly', label: 'Assembly (MLA)' },
  { value: 'municipal', label: 'Municipal ward' },
  { value: 'panchayat', label: 'Panchayat / village ward' },
];

export function useSeats(level) {
  return useQuery({
    queryKey: ['seats', level || 'all'],
    queryFn: async () => (await getJson(`/api/constituencies?limit=2000${level ? `&level=${level}` : ''}`)).seats || [],
  });
}

/**
 * The shared seat list. Seats are not tied to an election, so the master roll
 * can refer to them by code for every election.
 */
export default function SeatsPanel() {
  const queryClient = useQueryClient();
  const [levelFilter, setLevelFilter] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ code: '', name: '', level: 'assembly', state: '', district: '', city: '', village: '', ward: '', parentCode: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const { data: seats = [], isLoading } = useSeats(levelFilter);

  const visible = q
    ? seats.filter((s) => `${s.code} ${s.name} ${s.state} ${s.district} ${s.city} ${s.village}`.toLowerCase().includes(q.toLowerCase()))
    : seats;

  const addSeat = async () => {
    setMsg(null);
    setSaving(true);
    try {
      await postJson('/api/constituencies', form);
      setMsg({ type: 'success', text: `${form.name} added to the seat list.` });
      setForm((f) => ({ ...f, code: '', name: '', city: '', village: '', ward: '' }));
      queryClient.invalidateQueries({ queryKey: ['seats'] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
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
        const r = await fetch('/api/constituencies/upload-csv', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setResult(d);
        setMsg({ type: 'success', text: `${d.added} seat(s) added, ${d.updated} updated${d.errors?.length ? `, ${d.errors.length} row(s) skipped` : ''}.` });
        queryClient.invalidateQueries({ queryKey: ['seats'] });
      } catch (e) {
        setMsg({ type: 'error', text: e.message });
      } finally {
        setUploading(false);
      }
    },
  });

  const needsCity = form.level === 'municipal';
  const needsVillage = form.level === 'panchayat';

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={MapPinned}
        title="Seats"
        help="Lok Sabha and assembly seats, city wards and village wards. The voter roll refers to these by code; candidates stand in one of them."
        right={
          <a href="/api/constituencies/template" download className={secondaryBtn}>
            <Download size={12} /> CSV template
          </a>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
          <h5 className="text-xs font-semibold text-body uppercase tracking-wider">Add one seat</h5>
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect label="Type" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
              {SEAT_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </FieldSelect>
            <FieldInput label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MH-AC-258" />
            <div className="col-span-2">
              <FieldInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Karad North" />
            </div>
            <FieldInput label="State" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="Maharashtra" />
            <FieldInput label="District" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} placeholder="Satara" />
            {needsCity && <FieldInput label="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Pune" />}
            {needsVillage && <FieldInput label="Village" value={form.village} onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))} placeholder="Malkapur" />}
            {(needsCity || needsVillage) && <FieldInput label="Ward (optional)" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} placeholder="4" />}
            <FieldInput label="Parent seat code (optional)" value={form.parentCode} onChange={(e) => setForm((f) => ({ ...f, parentCode: e.target.value.toUpperCase() }))} placeholder="MH-PC-45" help="e.g. the Lok Sabha seat an assembly seat belongs to" />
          </div>
          <button type="button" onClick={addSeat} disabled={saving || !form.code || !form.name || !form.state} className={primaryBtn}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Add seat'}
          </button>
        </div>

        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
          <h5 className="text-xs font-semibold text-body uppercase tracking-wider">Import many seats</h5>
          <code className="block bg-surface-soft rounded-lg p-2.5 text-xs text-body font-mono break-all">
            code,name,level,state,district,city,village,ward,parentCode
          </code>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${isDragActive ? 'border-primary bg-primary/5' : 'border-hairline hover:border-primary/40'}`}>
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-primary" size={24} /><p className="text-body text-sm">Importing seats…</p></div>
            ) : (
              <div className="flex flex-col items-center gap-2"><Upload size={24} className="text-muted" /><p className="text-body text-sm">{isDragActive ? 'Drop the file here' : 'Drag a CSV here, or click to choose'}</p></div>
            )}
          </div>
          {result?.errors?.length > 0 && (
            <div className="bg-surface-soft border border-hairline rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-ink text-xs mb-1 font-semibold">Rows skipped ({result.errors.length}):</p>
              {result.errors.map((err, i) => <p key={i} className="text-semantic-down text-xs py-0.5">Row {err.row} · {err.code} — {err.reason}</p>)}
            </div>
          )}
        </div>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      <div className="flex flex-wrap items-center gap-3">
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className={`${inputClass} !w-auto`}>
          <option value="">All types</option>
          {SEAT_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, place…" className={`${inputClass} !w-64`} />
        <Pill>{visible.length} seat{visible.length === 1 ? '' : 's'}</Pill>
      </div>

      {isLoading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-body text-sm border border-dashed border-hairline rounded-xl bg-canvas">
          No seats yet. Add them one by one or import the CSV.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Place</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {visible.map((s) => (
                <tr key={s.code} className="hover:bg-surface-soft/50 transition">
                  <td className="px-4 py-2.5 font-mono text-xs text-ink">{s.code}</td>
                  <td className="px-4 py-2.5 text-ink font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-body text-xs">{SEAT_LEVELS.find((l) => l.value === s.level)?.label || s.level}</td>
                  <td className="px-4 py-2.5 text-body text-xs">{[s.ward && `Ward ${s.ward}`, s.village, s.city, s.district, s.state].filter(Boolean).join(', ')}</td>
                  <td className="px-4 py-2.5 text-muted font-mono text-xs hidden md:table-cell">{s.parentCode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
