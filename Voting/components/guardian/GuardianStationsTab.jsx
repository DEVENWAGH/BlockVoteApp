'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, RefreshCw, Users, CheckCircle2, Vote, ExternalLink,
  Search, MapPin, Eye, X, ShieldCheck, ArrowRight, Play, Check
} from 'lucide-react';

export default function GuardianStationsTab() {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [launchingCode, setLaunchingCode] = useState(null);

  // Inspection modal state
  const [inspectSeat, setInspectSeat] = useState(null);
  const [areaVoters, setAreaVoters] = useState([]);
  const [votersLoading, setVotersLoading] = useState(false);
  const [voterSearch, setVoterSearch] = useState('');

  const loadRegisteredSeats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/station/registered-seats');
      const data = await res.json();
      setSeats(data.seats || []);
    } catch (err) {
      console.error('Failed to load registered seats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegisteredSeats();
  }, [loadRegisteredSeats]);

  const enterStationDashboard = async (seat) => {
    setLaunchingCode(seat.code);
    const slug = (seat.code || seat.name || 'station').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      // 1-Click Activate booth session in backend
      await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: seat.electionId,
          stationName: seat.pollingStation,
          state: seat.state || 'Maharashtra',
          district: seat.district || 'Raigad',
          boothCode: seat.boothCode,
        }),
      });
      // Direct navigation to specific station URL: /station/[stationName]
      window.open(`/station/${slug}`, '_blank');
    } catch (err) {
      console.error('Failed to auto-activate station:', err);
      window.open(`/station/${slug}`, '_blank');
    } finally {
      setLaunchingCode(null);
      loadRegisteredSeats();
    }
  };

  const inspectVoters = async (seat) => {
    setInspectSeat(seat);
    setVotersLoading(true);
    setVoterSearch('');
    try {
      const params = new URLSearchParams({
        electionId: seat.electionId,
        stationName: seat.pollingStation,
        district: seat.district || '',
        state: seat.state || '',
      });
      const res = await fetch(`/api/station/voters?${params.toString()}`);
      const data = await res.json();
      setAreaVoters(data.voters || []);
    } catch (err) {
      console.error('Failed to load area voters:', err);
      setAreaVoters([]);
    } finally {
      setVotersLoading(false);
    }
  };

  const filteredSeats = seats.filter((s) => {
    const matchesQ = `${s.name} ${s.code} ${s.pollingStation} ${s.district} ${s.city}`
      .toLowerCase()
      .includes(q.toLowerCase());
    const matchesLevel = !levelFilter || s.level === levelFilter;
    return matchesQ && matchesLevel;
  });

  const totalVotersMapped = seats.reduce((acc, s) => acc + s.voterCount, 0);
  const seatsWithVoters = seats.filter((s) => s.voterCount > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">Registered Polling Stations & Seats</h3>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
              1-Click Direct Access
            </span>
          </div>
          <p className="text-xs text-body mt-1">
            Registered seats automatically map to physical polling stations. Click any station to enter its live dashboard directly without filling out forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRegisteredSeats}
            className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3.5 py-1.5 rounded-full bg-canvas hover:bg-surface-soft transition cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-primary' : ''} />
            <span>Sync Stations</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Registered Seats</p>
            <Landmark size={15} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{seats.length}</p>
          <p className="text-[11px] text-muted mt-0.5">Available polling stations</p>
        </div>

        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Voters Mapped</p>
            <Users size={15} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalVotersMapped}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Enrolled across areas</p>
        </div>

        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Stations with Voters</p>
            <ShieldCheck size={15} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{seatsWithVoters}</p>
          <p className="text-[11px] text-muted mt-0.5">Active jurisdictions</p>
        </div>

        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Access Mode</p>
            <CheckCircle2 size={15} className="text-primary" />
          </div>
          <p className="text-base font-bold text-ink mt-1">Instant 1-Click</p>
          <p className="text-[11px] text-muted mt-0.5">No manual forms required</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search seats, station names, districts..."
            className="w-full bg-canvas border border-hairline rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Seat Types</option>
            <option value="assembly">Assembly (MLA)</option>
            <option value="loksabha">Lok Sabha (MP)</option>
            <option value="municipal">Municipal Ward</option>
            <option value="panchayat">Panchayat Ward</option>
          </select>
          {(q || levelFilter) && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setLevelFilter('');
              }}
              className="text-xs text-muted hover:text-ink px-2 py-1 underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Registered Seats & Stations Grid */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <RefreshCw size={24} className="animate-spin text-primary" />
        </div>
      ) : filteredSeats.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas text-body text-xs">
          No registered seats or polling stations found matching your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSeats.map((seat) => (
            <div
              key={seat._id}
              className={`border rounded-2xl p-5 bg-canvas hover:border-primary/40 transition shadow-sm flex flex-col justify-between space-y-4 ${
                seat.voterCount > 0 ? 'border-primary/25 bg-primary/[0.01]' : 'border-hairline'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                        {seat.code}
                      </span>
                      <span className="text-[11px] uppercase font-semibold text-muted bg-surface-soft px-2 py-0.5 rounded">
                        {seat.level}
                      </span>
                    </div>
                    <h4 className="font-bold text-base text-ink">{seat.name}</h4>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      seat.voterCount > 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-surface-soft text-muted border border-hairline'
                    }`}
                  >
                    <Users size={12} />
                    {seat.voterCount} {seat.voterCount === 1 ? 'Voter' : 'Voters'}
                  </span>
                </div>

                {/* Polling Station Assignment */}
                <div className="mt-3 bg-surface-soft/60 border border-hairline rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-ink">
                    <Landmark size={14} className="text-primary shrink-0" />
                    <span>Station: {seat.pollingStation}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted text-[11px]">
                    <MapPin size={12} className="shrink-0" />
                    <span>{[seat.city, seat.district, seat.state].filter(Boolean).join(', ') || 'Area unassigned'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => enterStationDashboard(seat)}
                  disabled={launchingCode === seat.code}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-semibold text-xs py-2 px-3.5 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Play size={12} className="fill-current" />
                  <span>{launchingCode === seat.code ? 'Activating…' : 'Enter Station Dashboard'}</span>
                  <ArrowRight size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => inspectVoters(seat)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-body hover:text-ink border border-hairline hover:border-body px-3 py-2 rounded-xl bg-canvas hover:bg-surface-soft transition cursor-pointer"
                  title="Verify registered voters of this area"
                >
                  <Eye size={13} />
                  <span>Verify</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspect Voters Modal */}
      {inspectSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-canvas border border-hairline rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h4 className="font-semibold text-ink text-base flex items-center gap-2">
                  <Landmark size={17} className="text-primary" />
                  <span>Area Voters Roster — {inspectSeat.name} ({inspectSeat.code})</span>
                </h4>
                <p className="text-xs text-muted mt-0.5">
                  Station: {inspectSeat.pollingStation} · {[inspectSeat.district, inspectSeat.state].filter(Boolean).join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectSeat(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-surface-soft transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Voter Search Toolbar */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={voterSearch}
                onChange={(e) => setVoterSearch(e.target.value)}
                placeholder="Search local voters by name, Voter ID, phone..."
                className="w-full bg-surface-soft border border-hairline rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {votersLoading ? (
              <div className="flex justify-center py-8 text-muted">
                <RefreshCw size={20} className="animate-spin text-primary" />
              </div>
            ) : areaVoters.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-hairline rounded-xl text-body text-xs">
                No registered voters found matching this station's area.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-surface-soft border-b border-hairline text-body font-medium">
                      <th className="px-3 py-2">Voter ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Seat Code</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {areaVoters
                      .filter((v) =>
                        `${v.name} ${v.voterId} ${v.email} ${v.phone}`
                          .toLowerCase()
                          .includes(voterSearch.toLowerCase())
                      )
                      .map((v) => (
                        <tr key={v._id}>
                          <td className="px-3 py-2 font-mono font-semibold text-ink">
                            {v.voterId}
                          </td>
                          <td className="px-3 py-2 font-medium text-ink">
                            {v.name}
                            <span className="block text-[10px] text-muted">{v.email}</span>
                          </td>
                          <td className="px-3 py-2 text-body">
                            {v.assemblyConstituency || v.parliamentaryConstituency || '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {v.hasVoted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <CheckCircle2 size={10} /> Voted ({v.votedVia || 'booth'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                                Ready to vote
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  const s = inspectSeat;
                  setInspectSeat(null);
                  enterStationDashboard(s);
                }}
                className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Play size={12} className="fill-current" />
                <span>Launch Station Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectSeat(null)}
                className="bg-surface-soft hover:bg-surface border border-hairline text-ink text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
