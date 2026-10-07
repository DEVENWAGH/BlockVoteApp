'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, CheckCircle2, Copy, Loader2, RefreshCw, RotateCcw, UserX, Users } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { signGuardianAction } from '@/lib/guardianMessage';

const ROW_FIELDS = ['voterId', 'name', 'email', 'phone', 'gender', 'age', 'state', 'district', 'city', 'village', 'ward', 'partNo', 'homePollingStation', 'assemblyConstituency', 'parliamentaryConstituency'];

function Toast({ type, msg }) {
  const isErr = type === 'error';
  const bg = isErr
    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
    : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300';
  const Icon = isErr ? AlertCircle : CheckCircle;
  return (
    <div className={`flex items-start gap-2.5 border rounded-lg p-3.5 text-sm ${bg}`} role={isErr ? 'alert' : 'status'}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

function Compare({ c }) {
  const labels = c.fieldLabels || {};
  const changed = new Set((c.differences || []).map((d) => d.field));
  const rows = ROW_FIELDS.filter((f) => (c.newRow?.[f] ?? '') !== '' || (c.existing?.[f] ?? '') !== '');
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-soft border-b border-hairline text-body">
            <th className="text-left px-3 py-2 font-semibold w-40">Field</th>
            <th className="text-left px-3 py-2 font-semibold">Already on the roll</th>
            <th className="text-left px-3 py-2 font-semibold">New details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((f) => {
            const isDiff = changed.has(f) || (c.existing && String(c.existing[f] ?? '') !== String(c.newRow?.[f] ?? ''));
            return (
              <tr key={f} className={isDiff ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                <td className="px-3 py-1.5 text-body">{labels[f] || f}</td>
                <td className={`px-3 py-1.5 ${isDiff ? 'text-ink' : 'text-muted'}`}>{c.existing ? String(c.existing[f] ?? '') || '—' : '—'}</td>
                <td className={`px-3 py-1.5 font-medium ${isDiff ? 'text-ink' : 'text-muted'}`}>{String(c.newRow?.[f] ?? '') || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Duplicate or incomplete rows found while importing the roll. A guardian
 * decides each one with a wallet signature; the decision is recorded.
 */
export default function VoterCasesTab({ onSwitchToVoters }) {
  const { signer } = useWallet();
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, limit: '100' });
      if (kind) params.set('kind', kind);
      const r = await fetch(`/api/admin/voter-cases?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not load cases' });
    }
    setLoading(false);
  }, [status, kind]);

  useEffect(() => { load(); }, [load]);

  const decide = async (c, action) => {
    setMsg(null);
    setActing(`${c.id}:${action}`);
    try {
      const proof = await signGuardianAction(signer, { action: `voter-case:${action}`, target: String(c.id) });
      const r = await fetch('/api/admin/voter-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: c.id, action, note: notes[c.id] || '', ...proof }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      setNotes((n) => ({ ...n, [c.id]: '' }));
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setActing(null);
  };

  const cases = data?.cases || [];
  const counts = data?.counts || { open: 0, openMissing: 0, openDuplicate: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Voter cases</h3>
          <p className="text-xs text-body mt-0.5">
            Rows from the roll import that need a decision. Until you decide, that person cannot be enrolled or vote.
          </p>
        </div>
        <button type="button" onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ['Waiting', counts.open],
          ['Duplicates', counts.openDuplicate],
          ['Missing details', counts.openMissing],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface-soft border border-hairline rounded-xl p-3">
            <p className="text-xs text-body">{label}</p>
            <p className="text-xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[['open', 'Waiting'], ['resolved', 'Decided']].map(([v, label]) => (
          <button key={v} type="button" onClick={() => setStatus(v)} className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition cursor-pointer ${status === v ? 'bg-primary/10 text-primary border-primary/20' : 'bg-canvas text-body border-hairline'}`}>{label}</button>
        ))}
        <span className="w-px bg-hairline mx-1" />
        {[['', 'All'], ['duplicate', 'Duplicates'], ['missing', 'Missing details']].map(([v, label]) => (
          <button key={v || 'all'} type="button" onClick={() => setKind(v)} className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition cursor-pointer ${kind === v ? 'bg-primary/10 text-primary border-primary/20' : 'bg-canvas text-body border-hairline'}`}>{label}</button>
        ))}
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas space-y-3">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
          <div>
            <p className="text-ink font-semibold">{status === 'open' ? 'Zero Pending Dispute Cases' : 'No decided cases yet'}</p>
            <p className="text-body text-xs mt-1 max-w-md mx-auto">
              {status === 'open'
                ? 'All uploaded voters are valid and already enrolled into the master roll. Clean records do not produce dispute cases.'
                : 'Decisions you make will be listed here.'}
            </p>
          </div>
          {status === 'open' && onSwitchToVoters && (
            <button
              type="button"
              onClick={onSwitchToVoters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 px-4 py-2 rounded-full transition cursor-pointer"
            >
              <Users size={13} />
              <span>Verify Voters in Electoral Roll &rarr;</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => {
            const isDup = c.kind === 'duplicate';
            const busy = acting?.startsWith(`${c.id}:`);
            return (
              <div key={c.id} className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isDup ? <Copy size={15} className="text-amber-600" /> : <UserX size={15} className="text-semantic-down" />}
                      <h4 className="font-semibold text-ink text-sm">
                        {isDup ? 'Possible duplicate' : 'Missing details'} — {c.newRow?.name || 'Unnamed'} <span className="font-mono text-body text-xs">{c.newRow?.voterId || 'no voter ID'}</span>
                      </h4>
                      {c.status === 'resolved' && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-surface-strong text-body border-hairline">
                          {c.resolution === 'keep_existing' ? 'Kept existing' : c.resolution === 'use_new' ? 'Used new details' : 'Sent back'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-body mt-1">{(c.reasons || []).join(' ')}</p>
                    <p className="text-[10px] text-muted mt-1">
                      From <span className="font-mono">{c.sourceFile || 'manual entry'}</span>{c.rowNumber ? `, row ${c.rowNumber}` : ''} · {c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN') : ''}
                      {isDup && c.matchedOn?.length ? ` · matched on ${c.matchedOn.join(', ')}` : ''}
                    </p>
                  </div>
                </div>

                {isDup ? (
                  <Compare c={c} />
                ) : (
                  <div className="bg-surface-soft border border-hairline rounded-lg p-3 text-xs text-body grid grid-cols-2 md:grid-cols-4 gap-2">
                    {ROW_FIELDS.filter((f) => c.newRow?.[f]).map((f) => (
                      <div key={f}><span className="text-muted">{c.fieldLabels?.[f] || f}:</span> <span className="text-ink">{String(c.newRow[f])}</span></div>
                    ))}
                  </div>
                )}

                {c.status === 'open' ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={notes[c.id] || ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                      placeholder="Note for the record (optional)…"
                      className="w-full bg-canvas border border-hairline focus:border-primary text-ink px-3 py-2 rounded-lg outline-none text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      {isDup && (
                        <>
                          <button
                            type="button"
                            onClick={() => decide(c, 'keep_existing')}
                            disabled={busy}
                            className="bg-primary hover:bg-primary-active disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition shadow-sm inline-flex items-center gap-1.5"
                          >
                            {acting === `${c.id}:keep_existing` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={13} />} Keep existing
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(c, 'use_new')}
                            disabled={busy || !c.existing}
                            className="border border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-60 text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition inline-flex items-center gap-1.5"
                          >
                            {acting === `${c.id}:use_new` ? <Loader2 size={12} className="animate-spin" /> : <Users size={13} />} Use the new details
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => decide(c, 'send_back')}
                        disabled={busy}
                        className="border border-hairline hover:bg-surface-soft text-body hover:text-ink text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition inline-flex items-center gap-1.5"
                      >
                        {acting === `${c.id}:send_back` ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={13} />} Send back for correction
                      </button>
                    </div>
                    <p className="text-[11px] text-muted">
                      {isDup
                        ? '"Keep existing" leaves the roll as it is. "Use the new details" updates the person already on the roll with the highlighted fields. Each decision is signed with your wallet.'
                        : 'Rows with missing details can only be sent back; staff fix the file and upload again.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted font-mono">
                    Decided by {c.resolvedBy} · {c.resolvedAt ? new Date(c.resolvedAt).toLocaleString('en-IN') : ''}{c.resolutionNote ? ` · "${c.resolutionNote}"` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
