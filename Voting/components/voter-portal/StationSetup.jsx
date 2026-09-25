'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { AlertCircle, Landmark, Loader2, LogIn, Power, Vote } from 'lucide-react';

const PHASE_LABELS = ['Registration', 'Voting', 'Completed'];

export default function StationSetup({ signedIn, adminName, station }) {
  const [elections, setElections] = useState([]);
  const [electionId, setElectionId] = useState('');
  const [stationName, setStationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(signedIn);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/admin/managed-elections')
      .then((r) => r.json())
      .then((data) => {
        const open = (data.elections || []).filter((e) => Number(e.phase) !== 2);
        setElections(open);
        if (open.length === 1) setElectionId(open[0].id);
      })
      .catch(() => setError('Could not load your elections.'))
      .finally(() => setListLoading(false));
  }, [signedIn]);

  const activate = async (e) => {
    e.preventDefault();
    if (!electionId) {
      setError('Choose the election this booth is for.');
      return;
    }
    if (!stationName.trim()) {
      setError('Give this station a name, e.g. "Booth 12 – Ward 4".');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ electionId, stationName: stationName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not activate this station.');
      // Sign the admin out so voters at the booth cannot reach the dashboard.
      await signOut({ redirect: false });
      window.location.href = '/station/vote';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const closeStation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/station', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not close this station.');
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0F1D] text-white flex items-center justify-center px-6 py-12" style={{ colorScheme: 'dark' }}>
      <div className="max-w-lg w-full space-y-8">
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0078D4] flex items-center justify-center">
            <Landmark size={22} aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-pretty">Polling station setup</h1>
          <p className="text-white/65 leading-relaxed">
            The web ballot only opens on computers activated here by the election admin. Votes cast at a
            station are final and replace any app vote.
          </p>
        </div>

        {station && (
          <section className="rounded-2xl border border-[#2899F5]/30 bg-[#1A1F2C] px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#2899F5]">Active station</p>
              <p className="font-semibold mt-1">{station.stationName}</p>
              <p className="text-xs text-white/45 font-mono break-all mt-1">{station.electionId}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/station/vote"
                className="inline-flex items-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
              >
                <Vote size={16} aria-hidden="true" />
                Open ballot
              </Link>
              {signedIn ? (
                <button
                  type="button"
                  onClick={closeStation}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 hover:border-red-400/60 text-white/85 font-semibold px-5 py-2.5 transition-colors disabled:opacity-50"
                >
                  <Power size={16} aria-hidden="true" />
                  Close station
                </button>
              ) : (
                <Link
                  href="/login?callbackUrl=/station"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 hover:border-white/35 text-white/85 font-semibold px-5 py-2.5 transition-colors"
                >
                  <LogIn size={16} aria-hidden="true" />
                  Admin sign-in to close
                </Link>
              )}
            </div>
          </section>
        )}

        {!signedIn && !station && (
          <Link
            href="/login?callbackUrl=/station"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-6 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
          >
            <LogIn size={18} aria-hidden="true" />
            Sign in as election admin
          </Link>
        )}

        {signedIn && (
          <form onSubmit={activate} className="space-y-5">
            <p className="text-sm text-white/55">
              Signed in as <span className="text-white">{adminName || 'admin'}</span>. You will be signed out
              automatically once the station is active.
            </p>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Election</span>
              {listLoading ? (
                <p className="flex items-center gap-2 text-sm text-white/60 py-3">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Loading your elections…
                </p>
              ) : (
                <select
                  name="electionId"
                  value={electionId}
                  onChange={(e) => setElectionId(e.target.value)}
                  className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-3 outline-none"
                >
                  <option value="">Choose an election…</option>
                  {elections.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} — {PHASE_LABELS[Number(e.phase)] || 'Unknown'}
                      {e.guardianApproved ? '' : ' (not approved yet)'}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Station name</span>
              <input
                name="stationName"
                autoComplete="off"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                maxLength={80}
                placeholder="Booth 12 – Ward 4"
                className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-3 outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={loading || listLoading}
              className="w-full rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-6 py-3 transition-colors"
            >
              {loading ? 'Activating…' : station ? 'Switch this computer to the new station' : 'Activate this computer'}
            </button>
          </form>
        )}

        {error && (
          <p
            className="flex items-start gap-2 text-sm text-red-300 bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
