'use client';

import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const PHASE_LABELS = ['Not open', 'Voting open', 'Closed'];
export const PHASE_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  'bg-surface-strong text-muted border-hairline dark:bg-surface-strong/60 dark:text-body',
];

export const LEVELS = [
  { value: 'general', label: 'Single ballot', help: 'Everyone enrolled sees the same candidates (clubs, societies, housing).' },
  { value: 'panchayat', label: 'Gram panchayat / village ward', help: 'Each village or ward votes for its own candidates.' },
  { value: 'municipal', label: 'Municipal ward', help: 'Each city ward votes for its own candidates.' },
  { value: 'assembly', label: 'Assembly (MLA)', help: 'Voters see candidates of their home assembly seat.' },
  { value: 'loksabha', label: 'Lok Sabha (MP)', help: 'Voters see candidates of their home parliamentary seat.' },
];

export function levelLabel(level) {
  return LEVELS.find((l) => l.value === (level || 'general'))?.label || 'Single ballot';
}

export const inputClass =
  'w-full bg-canvas border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition';

export function FieldInput({ label, value, onChange, placeholder = '', type = 'text', multiline = false, help = '', ...rest }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-ink">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} className={`${inputClass} resize-y min-h-[80px]`} {...rest} />
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={inputClass} {...rest} />
      )}
      {help && <p className="text-xs text-muted">{help}</p>}
    </div>
  );
}

export function FieldSelect({ label, value, onChange, children, help = '', ...rest }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-ink">{label}</label>
      <select value={value} onChange={onChange} className={inputClass} {...rest}>
        {children}
      </select>
      {help && <p className="text-xs text-muted">{help}</p>}
    </div>
  );
}

export function Toast({ type, msg }) {
  const isErr = type === 'error';
  const bg = isErr
    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
    : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300';
  const Icon = isErr ? AlertCircle : CheckCircle;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2.5 items-start border rounded-lg p-3 text-sm ${bg}`} role={isErr ? 'alert' : 'status'}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span>{msg}</span>
    </motion.div>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <div className="flex justify-center py-4">
      <Loader2 className="animate-spin text-primary" size={size} />
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-surface-strong text-ink border-hairline',
    good: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
    warn: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    bad: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  };
  return <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${tones[tone] || tones.neutral}`}>{children}</span>;
}

export function StatusPill({ status }) {
  if (status === 'registered') return <Pill tone="good">Registered</Pill>;
  if (status === 'rejected') return <Pill tone="bad">Could not register</Pill>;
  return <Pill tone="warn">Waiting</Pill>;
}

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-active disabled:opacity-50 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition shadow-sm cursor-pointer';
export const secondaryBtn =
  'inline-flex items-center justify-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-2 rounded-full font-medium transition cursor-pointer bg-canvas disabled:opacity-50';

/** Upload an image to S3 via the app proxy; returns the stored URL. */
export async function uploadImage(file, folder) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const r = await fetch('/api/uploads', { method: 'POST', body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Upload failed');
  return d.url;
}

export async function postJson(url, body, method = 'POST') {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

export async function getJson(url) {
  const r = await fetch(url);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

export function SectionTitle({ icon: Icon, title, help, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="text-ink font-semibold flex items-center gap-2 text-sm">
          {Icon && <Icon size={15} className="text-primary" />} {title}
        </h4>
        {help && <p className="text-xs text-body mt-0.5">{help}</p>}
      </div>
      {right}
    </div>
  );
}
