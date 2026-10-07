'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Landmark, Loader2, MapPin, RefreshCw, Search, UserCheck } from 'lucide-react';
import { FieldInput, FieldSelect, Toast, Spinner, SectionTitle, Pill, StatusPill, primaryBtn, secondaryBtn, inputClass, postJson, getJson } from './ui';
import { useSeats } from './SeatsPanel';

function fmtDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

/**
 * Who is in this election. People come from the master roll by place.
 * Each row shows the home seat (what they vote for) and, once they voted,
 * the booth they voted at — which may be anywhere in the country.
 */
export default function EnrollmentPanel({ electionId, level, phase }) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState({ state: '', district: '', city: '', village: '', constituencyCode: '' });
  const [everyone, setEveryone] = useState(false);
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = level && level !== 'general';
  const { data: seats = [] } = useSeats(filtered ? level : '');

  const { data: info, isLoading } = useQuery({
    queryKey: ['enrollment', electionId],
    queryFn: () => getJson(`/api/elections/${electionId}/enroll`),
    enabled: !!electionId,
  });

  const listParams = new URLSearchParams({ electionId, limit: '100', status });
  if (search) listParams.set('q', search);
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['voters', electionId, search, status],
    queryFn: () => getJson(`/api/voters/list?${listParams.toString()}`),
    enabled: !!electionId,
  });

  const states = useMemo(() => [...new Set(seats.map((s) => s.state).filter(Boolean))].sort(), [seats]);
  const summary = info?.summary || { total: 0, registered: 0, pending: 0, rejected: 0, voted: 0 };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollment', electionId] });
    queryClient.invalidateQueries({ queryKey: ['voters', electionId] });
    queryClient.invalidateQueries({ queryKey: ['checklist', electionId] });
  };

  const runPreview = async () => {
    setMsg(null);
    setWorking(true);
    try {
      const d = await postJson(`/api/elections/${electionId}/enroll`, { scope, everyone, preview: true });
      setPreview(d);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setWorking(false);
    }
  };

  const enroll = async () => {
    setMsg(null);
    setWorking(true);
    try {
      const d = await postJson(`/api/elections/${electionId}/enroll`, { scope, everyone });
      setMsg({ type: 'success', text: `${d.message} ${d.registration?.remaining ? `${d.registration.remaining} still need on-chain registration — use "Register waiting voters".` : ''}`.trim() });
      setPreview(null);
      refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setWorking(false);
    }
  };

  const registerWaiting = async () => {
    setMsg(null);
    setRegistering(true);
    try {
      const d = await postJson('/api/voters/bulk-register', { electionId, limit: 100 });
      setMsg({ type: 'success', text: d.message });
      refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setRegistering(false);
    }
  };

  const voters = list?.voters || [];

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={UserCheck}
        title="Voters in this election"
        help="Include people from the master roll by place. Their ballot always comes from their home address — never from the booth they vote at."
        right={<button type="button" onClick={refresh} className={secondaryBtn}><RefreshCw size={11} /> Refresh</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['Enrolled', summary.total, 'neutral'],
          ['Registered', summary.registered, 'good'],
          ['Waiting', summary.pending, summary.pending ? 'warn' : 'neutral'],
          ['Could not register', summary.rejected, summary.rejected ? 'bad' : 'neutral'],
          ['Voted', summary.voted, 'info'],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface-soft border border-hairline rounded-xl p-3">
            <p className="text-xs text-body">{label}</p>
            <p className="text-xl font-semibold text-ink mt-0.5">{Number(value || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {summary.pending > 0 && (
        <button type="button" onClick={registerWaiting} disabled={registering} className={`${primaryBtn} w-full`}>
          {registering ? <><Loader2 size={14} className="animate-spin" /> Registering on-chain…</> : <><CheckCircle size={14} /> Register {summary.pending.toLocaleString()} waiting voter{summary.pending === 1 ? '' : 's'} (100 at a time)</>}
        </button>
      )}

      {phase === 0 && (
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
          <h5 className="text-xs font-semibold text-body uppercase tracking-wider flex items-center gap-2"><MapPin size={14} className="text-primary" /> Include voters by place</h5>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {states.length > 0 ? (
              <FieldSelect label="State" value={scope.state} onChange={(e) => setScope((s) => ({ ...s, state: e.target.value }))}>
                <option value="">Any</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </FieldSelect>
            ) : (
              <FieldInput label="State" value={scope.state} onChange={(e) => setScope((s) => ({ ...s, state: e.target.value }))} placeholder="Maharashtra" />
            )}
            <FieldInput label="District" value={scope.district} onChange={(e) => setScope((s) => ({ ...s, district: e.target.value }))} placeholder="Any" />
            <FieldInput label="City" value={scope.city} onChange={(e) => setScope((s) => ({ ...s, city: e.target.value }))} placeholder="Any" />
            <FieldInput label="Village" value={scope.village} onChange={(e) => setScope((s) => ({ ...s, village: e.target.value }))} placeholder="Any" />
            {filtered && (level === 'assembly' || level === 'loksabha') ? (
              <FieldSelect label="Seat" value={scope.constituencyCode} onChange={(e) => setScope((s) => ({ ...s, constituencyCode: e.target.value }))}>
                <option value="">Any</option>
                {seats.filter((s) => !scope.state || s.state === scope.state).map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </FieldSelect>
            ) : (
              <FieldInput label="Seat code" value={scope.constituencyCode} onChange={(e) => setScope((s) => ({ ...s, constituencyCode: e.target.value.toUpperCase() }))} placeholder="Any" />
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-body cursor-pointer">
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
            Everyone on the roll (ignore the place filters)
          </label>
          {preview && (
            <p className="text-sm text-ink bg-surface-soft border border-hairline rounded-lg px-3 py-2">
              <strong>{preview.matched.toLocaleString()}</strong> people match {preview.label}
              {preview.alreadyEnrolled ? ` — ${preview.alreadyEnrolled.toLocaleString()} already included` : ''}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runPreview} disabled={working} className={secondaryBtn}>
              {working ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Count first
            </button>
            <button type="button" onClick={enroll} disabled={working} className={primaryBtn}>
              {working ? <><Loader2 size={14} className="animate-spin" /> Working…</> : 'Include these voters'}
            </button>
          </div>
          <p className="text-xs text-muted">
            People with an open guardian case are skipped. {filtered ? 'People whose home does not match any seat of this type are skipped too.' : ''}
          </p>
        </div>
      )}

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {isLoading ? (
        <Spinner />
      ) : info?.bySeat?.length > 0 && filtered ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                <th className="text-left px-4 py-3 font-semibold">Seat</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Place</th>
                <th className="text-right px-4 py-3 font-semibold">Voters</th>
                <th className="text-right px-4 py-3 font-semibold">Registered</th>
                <th className="text-right px-4 py-3 font-semibold">Voted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {info.bySeat.map((s) => (
                <tr key={s.code || 'none'}>
                  <td className="px-4 py-2.5 text-ink font-medium">{s.name} <span className="text-muted font-mono text-xs">{s.code}</span></td>
                  <td className="px-4 py-2.5 text-body text-xs hidden md:table-cell">{[s.district, s.state].filter(Boolean).join(', ')}</td>
                  <td className="px-4 py-2.5 text-right text-ink">{s.voters.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-body">{s.registered.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-body">{s.voted.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {info?.rules?.length > 0 && (
        <div className="text-xs text-body space-y-1">
          <p className="font-semibold text-ink">Included so far</p>
          {info.rules.map((r, i) => (
            <p key={i}>• {r.label} — {r.enrolled.toLocaleString()} added{r.skippedCases ? `, ${r.skippedCases} skipped (guardian case)` : ''} · {fmtDate(r.at)}</p>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Voter ID, name or email" className={`${inputClass} !pl-9 !w-72`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} !w-auto`}>
          <option value="all">All</option>
          <option value="registered">Registered</option>
          <option value="pending">Waiting</option>
          <option value="rejected">Could not register</option>
        </select>
        <button type="submit" className={secondaryBtn}>Search</button>
        {list && <Pill>{list.total.toLocaleString()} shown</Pill>}
      </form>

      {listLoading ? (
        <Spinner />
      ) : voters.length === 0 ? (
        <div className="text-center py-10 text-body text-sm border border-dashed border-hairline rounded-xl bg-canvas">
          {summary.total === 0 ? 'Nobody is included yet. Use "Include voters by place" above.' : 'Nobody matches this search.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                <th className="text-left px-4 py-3 font-semibold">Voter</th>
                <th className="text-left px-4 py-3 font-semibold">Home seat</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Voted at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {voters.map((v) => (
                <tr key={v._id} className="hover:bg-surface-soft/50 transition">
                  <td className="px-4 py-2.5">
                    <p className="text-ink font-medium">{v.name || '—'}</p>
                    <p className="text-muted font-mono text-[11px]">{v.voterId} · {v.email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <p className="text-ink">{v.constituencyName || (filtered ? v.constituencyCode || '—' : 'Single ballot')}</p>
                    <p className="text-muted">{v.homePlace}</p>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={v.status} /></td>
                  <td className="px-4 py-2.5 text-xs">
                    {v.votesCast > 0 ? (
                      <>
                        <p className="text-ink flex items-center gap-1">
                          {v.votedVia === 'station' ? <Landmark size={12} className="text-primary" /> : null}
                          {v.votedVia === 'station' ? (v.votedAtBoothName || 'Polling booth') : 'App'}
                          {v.stationVoteFinal && <Pill tone="info">Final</Pill>}
                        </p>
                        <p className="text-muted">{fmtDate(v.votedAt)}</p>
                      </>
                    ) : (
                      <span className="text-muted">Not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
