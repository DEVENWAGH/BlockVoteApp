'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { Toast } from './ui';

/** Identical twins can share facial geometry; staff approve a manual override here. */
export default function TwinOverridesPanel({ slug, electionId }) {
  const [notes, setNotes] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [backfilling, setBackfilling] = useState(false);

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['twinRequests', slug, electionId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/twin-requests?electionId=${electionId}`);
      const d = await r.json();
      return d.requests || [];
    },
    enabled: electionId != null,
  });

  const handleAction = async (nullifierHash, action) => {
    setProcessingId(nullifierHash);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/twin-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nullifierHash, action, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update this request.');
      setMsg({ type: 'success', text: action === 'approve' ? 'Approved — this voter can now pass the face check.' : 'Rejected.' });
      setNotes('');
      refetch();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/fix-biometric-org-scope', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed.');
      setMsg({ type: 'success', text: data.message });
      refetch();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-ink font-semibold flex items-center gap-2 text-sm">
            <Shield size={15} className="text-primary" /> Face check: look-alike requests
          </h4>
          <p className="text-xs text-body mt-0.5">When two people (often twins) look alike to the camera, the booth officer asks for a manual approval here.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-hairline rounded-xl bg-canvas space-y-3">
          <p className="text-body text-xs font-semibold">No look-alike requests for this election.</p>
          <p className="text-muted text-[11px] px-4">
            If you expected some, older face records may not be linked to this election yet. Use the sync button to link them.
          </p>
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfilling}
            className="inline-flex items-center gap-1.5 text-xs bg-surface-strong hover:bg-hairline border border-hairline text-ink px-4 py-2 rounded-full font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {backfilling ? <><Loader2 size={11} className="animate-spin" /> Syncing…</> : <><RefreshCw size={11} /> Sync older records</>}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas shadow-sm">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body font-semibold">
                <th className="px-4 py-3">Voter</th>
                <th className="px-4 py-3">Looks like</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {requests.map((r) => (
                <tr key={r.nullifierHash} className="hover:bg-surface-soft/40 transition">
                  <td className="px-4 py-3">
                    <p className="font-bold text-ink">{r.name}</p>
                    <p className="text-muted font-mono text-[10px]">{r.voterId || r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{r.twinMatchedName}</p>
                    <p className="text-muted font-mono text-[10px]">{r.twinMatchedEmail}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">{r.twinMatchSimilarity}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                      r.twinVerificationStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800' :
                      r.twinVerificationStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' :
                      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }`}>
                      {r.twinVerificationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body max-w-[150px] truncate" title={r.twinNotes}>{r.twinNotes || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.twinVerificationStatus !== 'approved' && (
                        <button
                          type="button"
                          disabled={processingId === r.nullifierHash}
                          onClick={() => handleAction(r.nullifierHash, 'approve')}
                          className="bg-primary hover:bg-primary-active text-white px-3 py-1.5 rounded-full font-bold text-[10px] transition cursor-pointer disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {r.twinVerificationStatus !== 'rejected' && (
                        <button
                          type="button"
                          disabled={processingId === r.nullifierHash}
                          onClick={() => handleAction(r.nullifierHash, 'reject')}
                          className="bg-surface-strong hover:bg-hairline text-ink px-3 py-1.5 rounded-full font-bold text-[10px] border border-hairline transition cursor-pointer disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 bg-surface-soft/40 border-t border-hairline flex gap-2">
            <input
              type="text"
              placeholder="Note for the record (optional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 bg-canvas border border-hairline focus:border-primary text-ink px-3 py-1.5 rounded-lg outline-none text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
