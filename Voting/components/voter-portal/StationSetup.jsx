'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertCircle, Landmark, Loader2, Power, Vote, Search,
  Users, CheckCircle2, MapPin, RefreshCw, ArrowRight, Play, Check,
  Award, Clock, Lock, UserPlus, Flag, Sparkles, PlusCircle, CheckCircle,
  Globe,
} from 'lucide-react';

export default function StationSetup({ signedIn: initialSignedIn, adminName, station: initialStation }) {
  const [station, setStation] = useState(initialStation);
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'voters' | 'candidates'
  const [registeredSeats, setRegisteredSeats] = useState([]);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [activatingCode, setActivatingCode] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState('');

  // Election Live Status state
  const [electionInfo, setElectionInfo] = useState(null);
  const [electionLoading, setElectionLoading] = useState(false);

  // Area Voters state
  const [voters, setVoters] = useState([]);
  const [votersLoading, setVotersLoading] = useState(false);
  const [voterQuery, setVoterQuery] = useState('');
  const [voterStats, setVoterStats] = useState({ total: 0, votedCount: 0, pendingCount: 0 });

  // Seat Candidates state
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    name: '',
    party: '',
    partyCode: '',
    manifesto: '',
    symbol: '',
  });
  const [nominationMsg, setNominationMsg] = useState(null);


  // Auto-sync station session cookie whenever station is set
  useEffect(() => {
    if (station && station.electionId) {
      fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: station.electionId,
          stationName: station.stationName,
          state: station.state || 'Maharashtra',
          district: station.district || 'Raigad',
          boothCode: station.boothCode || '',
        }),
      }).catch((e) => console.warn('Station auto-sync error:', e));
    }
  }, [station]);

  const loadElectionInfo = useCallback(async () => {
    if (!station?.electionId) return;
    setElectionLoading(true);
    try {
      const res = await fetch(`/api/elections/${station.electionId}`);
      if (res.ok) {
        const data = await res.json();
        setElectionInfo(data.data || null);
      }
    } catch (e) {
      console.warn('Election info fetch:', e);
    } finally {
      setElectionLoading(false);
    }
  }, [station?.electionId]);

  useEffect(() => {
    if (station) {
      loadElectionInfo();
    }
  }, [station, loadElectionInfo]);

  const loadRegisteredSeats = useCallback(async () => {
    setSeatsLoading(true);
    try {
      const res = await fetch('/api/station/registered-seats');
      const data = await res.json();
      setRegisteredSeats(data.seats || []);

      const params = new URLSearchParams(window.location.search);
      const autoSeatCode = params.get('seat');
      if (autoSeatCode && !station) {
        const match = (data.seats || []).find((s) => s.code.toLowerCase() === autoSeatCode.toLowerCase());
        if (match) {
          activateSeatDirectly(match);
        }
      }
    } catch {
      setError('Could not load registered stations.');
    } finally {
      setSeatsLoading(false);
    }
  }, [station]);

  useEffect(() => {
    loadRegisteredSeats();
  }, [loadRegisteredSeats]);

  const loadAreaVoters = useCallback(async () => {
    if (!station) return;
    setVotersLoading(true);
    try {
      const params = new URLSearchParams({
        electionId: station.electionId || '',
        stationName: station.stationName || '',
        district: station.district || '',
        state: station.state || '',
        ward: station.ward || '',
        city: station.city || '',
        constituency: station.assemblyConstituency || '',
      });
      if (voterQuery.trim()) params.set('q', voterQuery.trim());
      const res = await fetch(`/api/station/voters?${params.toString()}`);
      const data = await res.json();
      setVoters(data.voters || []);
      setVoterStats({
        total: data.total || 0,
        votedCount: data.votedCount || 0,
        pendingCount: data.pendingCount || 0,
      });
    } catch (err) {
      console.error('Failed to load area voters:', err);
    } finally {
      setVotersLoading(false);
    }
  }, [station, voterQuery]);

  useEffect(() => {
    if (station) {
      loadAreaVoters();
    }
  }, [station, loadAreaVoters]);

  const loadCandidates = useCallback(async () => {
    if (!station?.electionId) return;
    setCandidatesLoading(true);
    try {
      const params = new URLSearchParams({
        electionId: station.electionId,
        constituencyCode: station.assemblyConstituency || '',
      });
      const res = await fetch(`/api/station/candidates?${params.toString()}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err) {
      console.error('Failed to load seat candidates:', err);
    } finally {
      setCandidatesLoading(false);
    }
  }, [station?.electionId, station?.assemblyConstituency]);

  useEffect(() => {
    if (station) {
      loadCandidates();
    }
  }, [station, loadCandidates]);

  const handleNominateCandidate = async (e) => {
    e.preventDefault();
    if (!candidateForm.name.trim() || !candidateForm.party.trim()) {
      setNominationMsg({ type: 'error', text: 'Candidate name and Party are required.' });
      return;
    }
    setCandidateSubmitting(true);
    setNominationMsg(null);
    try {
      const res = await fetch('/api/station/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: station.electionId,
          name: candidateForm.name.trim(),
          party: candidateForm.party.trim(),
          partyCode: candidateForm.partyCode.trim() || candidateForm.party.trim().slice(0, 5).toUpperCase(),
          constituencyCode: station.assemblyConstituency || '',
          constituencyName: station.stationName || '',
          manifesto: candidateForm.manifesto.trim(),
          symbol: candidateForm.symbol.trim(),
          stationName: station.stationName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to nominate candidate');

      setNominationMsg({
        type: 'success',
        text: 'Candidate nominated successfully! Awaiting Guardian approval in the Guardian Portal.',
      });
      setCandidateForm({ name: '', party: '', partyCode: '', manifesto: '', symbol: '' });
      loadCandidates();
    } catch (err) {
      setNominationMsg({ type: 'error', text: err.message });
    } finally {
      setCandidateSubmitting(false);
    }
  };


  const activateSeatDirectly = async (seat) => {
    setActivatingCode(seat.code);
    setError('');
    try {
      const res = await fetch('/api/station', {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start this booth.');

      const slug = (seat.code || seat.name || 'station').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      window.history.pushState({}, '', `/station/${slug}`);

      setStation({
        stationName: seat.pollingStation,
        electionId: seat.electionId,
        electionTitle: seat.electionTitle,
        state: seat.state || 'Maharashtra',
        district: seat.district || 'Raigad',
        boothCode: seat.boothCode,
        assemblyConstituency: seat.code,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setActivatingCode(null);
    }
  };

  // Determine ballot open state
  const currentPhase = electionInfo?.phase ?? (station?.electionPhase !== undefined ? station.electionPhase : (station?.electionStatus === 'Voting open' ? 1 : 0));
  const isBallotOpen = currentPhase === 1;
  const isElectionClosed = currentPhase === 2;

  const handleOpenBallot = async (e) => {
    e.preventDefault();
    // Don't open ballot if guardian hasn't activated voting
    if (!isBallotOpen) {
      setError('Voting is not active yet. Guardian must approve and start the election first.');
      return;
    }
    if (station && station.electionId) {
      try {
        await fetch('/api/station', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            electionId: station.electionId,
            stationName: station.stationName,
            state: station.state || 'Maharashtra',
            district: station.district || 'Raigad',
            boothCode: station.boothCode,
          }),
        });
      } catch (err) {
        console.warn('Failed to sync station before opening ballot:', err);
      }
    }
    window.location.href = '/station/vote';
  };

  const closeStation = async () => {
    try {
      await fetch('/api/station', { method: 'DELETE' });
      setStation(null);
      window.history.pushState({}, '', '/station');
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredSeats = registeredSeats.filter((s) =>
    `${s.name} ${s.code} ${s.pollingStation} ${s.district} ${s.city}`
      .toLowerCase()
      .includes(searchFilter.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#0A0F1D] text-white px-6 py-10" style={{ colorScheme: 'dark' }}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0078D4] flex items-center justify-center shrink-0">
              <Landmark size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Polling Station Officer Desk</h1>
              <p className="text-white/60 text-xs">
                Physical booth management & registered area voters roster. Verified under Sovereign Guardian Authority.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-xs text-white/70 hover:text-white border border-white/15 px-3 py-1.5 rounded-full hover:bg-white/5 transition"
            >
              Guardian Portal &rarr;
            </Link>
          </div>
        </div>

        {error && (
          <p
            className="flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/50 rounded-xl p-3"
            role="alert"
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
            {error}
          </p>
        )}

        {/* ACTIVE BOOTH DASHBOARD */}
        {station ? (
          <div className="space-y-6">
            {/* Top Navigation Tabs */}
            <div className="flex border-b border-white/10 gap-2 pb-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('terminal')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'terminal'
                    ? 'bg-[#141A2E] text-white border-t border-x border-[#2899F5]/40 text-[#2899F5]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Landmark size={14} />
                <span>Polling Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voters')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'voters'
                    ? 'bg-[#141A2E] text-white border-t border-x border-[#2899F5]/40 text-[#2899F5]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users size={14} />
                <span>Registered Area Voters ({voterStats.total})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('candidates')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === 'candidates'
                    ? 'bg-[#141A2E] text-white border-t border-x border-[#2899F5]/40 text-[#2899F5]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Award size={14} />
                <span>Candidates &amp; Nominations ({candidates.length})</span>
              </button>

            </div>

            {/* TAB 1: POLLING TERMINAL (OVERVIEW & BALLOT) */}
            {activeTab === 'terminal' && (
              <div className="space-y-6">
                {/* Station Banner */}
                <section className="rounded-2xl border border-[#2899F5]/40 bg-[#141A2E] p-6 space-y-5 shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 size={12} /> Active Polling Terminal
                        </span>
                        {station.ward && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#0078D4]/20 text-[#2899F5] border border-[#0078D4]/40">
                            Ward {station.ward}
                          </span>
                        )}
                        {station.assemblyConstituency && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Seat: {station.assemblyConstituency}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-bold mt-2">{station.stationName}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/65 mt-1">
                        {(station.city || station.district || station.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-[#2899F5]" />
                            {[station.city, station.district, station.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {station.boothCode && (
                          <span className="font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                            Code: {station.boothCode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={closeStation}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 hover:border-white/40 text-white/80 hover:bg-white/5 font-medium px-4 py-2 transition text-xs cursor-pointer"
                      >
                        <Power size={13} />
                        Switch Station
                      </button>
                    </div>
                  </div>

                  {/* Station Metric Cards */}
                  <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                    <div
                      onClick={() => setActiveTab('voters')}
                      className="bg-[#0D1222] border border-white/10 rounded-xl p-3 cursor-pointer hover:border-[#2899F5]/50 transition"
                    >
                      <p className="text-xs text-white/50">Area Registered Voters</p>
                      <p className="text-xl font-bold text-white mt-0.5">{voterStats.total}</p>
                    </div>
                    <div className="bg-[#0D1222] border border-white/10 rounded-xl p-3">
                      <p className="text-xs text-white/50">Ballots Cast</p>
                      <p className="text-xl font-bold text-emerald-400 mt-0.5">{voterStats.votedCount}</p>
                    </div>
                    <div
                      onClick={() => setActiveTab('candidates')}
                      className="bg-[#0D1222] border border-white/10 rounded-xl p-3 cursor-pointer hover:border-[#2899F5]/50 transition"
                    >
                      <p className="text-xs text-white/50">Seat Candidates</p>
                      <p className="text-xl font-bold text-blue-400 mt-0.5">{candidates.length}</p>
                    </div>
                  </div>
                </section>

                {/* LIVE BALLOT STATUS & VOTING LAUNCHER */}
                <section className={`rounded-2xl border p-6 space-y-4 shadow-lg ${
                  isBallotOpen
                    ? 'bg-gradient-to-br from-[#0F281E] to-[#141A2E] border-emerald-500/40'
                    : isElectionClosed
                    ? 'bg-[#141A2E] border-white/10'
                    : 'bg-gradient-to-br from-[#231A0F] to-[#141A2E] border-amber-500/40'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isBallotOpen
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isElectionClosed
                            ? 'bg-white/10 text-white/60 border border-white/20'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {isBallotOpen ? <CheckCircle2 size={13} /> : isElectionClosed ? <Lock size={13} /> : <Clock size={13} />}
                          {isBallotOpen
                            ? 'Ballot Open – Voting in Progress'
                            : isElectionClosed
                            ? 'Voting Concluded – Election Closed'
                            : 'Ballot Pending – Waiting for Guardian to Start Election'}
                        </span>
                        <button
                          type="button"
                          onClick={loadElectionInfo}
                          title="Refresh status"
                          className="text-white/50 hover:text-white p-1"
                        >
                          <RefreshCw size={12} className={electionLoading ? 'animate-spin' : ''} />
                        </button>
                      </div>

                      <h3 className="text-xl font-bold text-white mt-2">
                        {isBallotOpen
                          ? 'Supervised In-Person Voting Terminal is Active'
                          : isElectionClosed
                          ? 'This election has ended.'
                          : 'Election Setup Phase (Ballot Closed)'}
                      </h3>
                      <p className="text-xs text-white/65 max-w-xl mt-1 leading-relaxed">
                        {isBallotOpen
                          ? 'Any registered voter can walk in and vote here — they will see candidates from their home constituency. Remote voters are fully supported.'
                          : isElectionClosed
                          ? 'Voting has concluded. Final tallies and cryptographic receipts are visible on the public records ledger.'
                          : 'Voting is not active yet. Once Sovereign Guardians approve and sign to open voting in the Guardian Portal, voting on this terminal will immediately open.'}
                      </p>
                      {isBallotOpen && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#0078D4]/15 text-[#2899F5] border border-[#0078D4]/30">
                            <Globe size={12} />
                            Remote Voting Enabled — Voters from any area can vote here
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      {isBallotOpen ? (
                        <button
                          type="button"
                          onClick={handleOpenBallot}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3.5 transition shadow-xl cursor-pointer text-sm"
                        >
                          <Vote size={19} />
                          Open Voting Ballot
                        </button>
                      ) : (
                        <div className="text-right">
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/40 font-semibold px-6 py-2.5 cursor-not-allowed text-xs border border-white/10"
                          >
                            <Lock size={14} />
                            Voting Locked (Pending Start)
                          </button>
                          <p className="text-[11px] text-amber-400/80 mt-1.5">
                            Guardian must approve on /admin
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Quick Shortcuts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setActiveTab('voters')}
                    className="p-5 rounded-xl border border-white/10 bg-[#141A2E] hover:border-[#2899F5]/40 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-1.5 text-white">
                        <Users size={16} className="text-[#2899F5]" />
                        Registered Voters of This Area
                      </h4>
                      <p className="text-xs text-white/50 mt-1">
                        View roll of {voterStats.total} registered voters for this ward.
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-white/40" />
                  </div>

                  <div
                    onClick={() => setActiveTab('candidates')}
                    className="p-5 rounded-xl border border-white/10 bg-[#141A2E] hover:border-[#2899F5]/40 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-1.5 text-white">
                        <Award size={16} className="text-[#2899F5]" />
                        Seat Candidates &amp; Nominations
                      </h4>
                      <p className="text-xs text-white/50 mt-1">
                        View candidates standing or nominate candidate for Guardian approval.
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-white/40" />
                  </div>
                </div>
              </div>
            )}



            {/* TAB 2: REGISTERED AREA VOTERS ROSTER */}
            {activeTab === 'voters' && (
              <section className="bg-[#141A2E] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Users size={18} className="text-[#2899F5]" />
                      <span>Registered Voters of This Area</span>
                    </h3>
                    <p className="text-xs text-white/60 mt-0.5">
                      Polling station roster for {station.stationName || station.district || 'this area'}. Check in voters upon arrival before voting.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadAreaVoters}
                    className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white border border-white/15 px-3 py-1.5 rounded-full hover:bg-white/5 transition cursor-pointer"
                  >
                    <RefreshCw size={12} className={votersLoading ? 'animate-spin' : ''} />
                    <span>Refresh Roster</span>
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={voterQuery}
                    onChange={(e) => setVoterQuery(e.target.value)}
                    placeholder="Check in voter by Name, EPIC Voter ID, Phone or Email..."
                    className="w-full bg-[#0D1222] border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#2899F5]"
                  />
                </div>

                {/* Voters Table */}
                {votersLoading ? (
                  <div className="flex justify-center py-8 text-white/40">
                    <Loader2 size={24} className="animate-spin text-[#2899F5]" />
                  </div>
                ) : voters.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-white/15 rounded-xl text-white/50 text-xs">
                    No registered voters found matching this station or search filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0D1222]">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-white/70 font-medium">
                          <th className="px-4 py-3">Voter ID (EPIC)</th>
                          <th className="px-4 py-3">Full Name &amp; Contact</th>
                          <th className="px-4 py-3">Ward / Station</th>
                          <th className="px-4 py-3">Seat Code</th>
                          <th className="px-4 py-3 text-right">Voting Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {voters.map((v) => (
                          <tr key={v._id} className="hover:bg-white/5 transition">
                            <td className="px-4 py-3 font-mono font-bold text-white">
                              <span className="bg-white/10 px-2 py-0.5 rounded border border-white/15">
                                {v.voterId}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{v.name}</p>
                              <p className="text-[11px] text-white/50">{v.email}</p>
                              {v.phone && <p className="text-[10px] text-white/40">Tel: {v.phone}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white/80">{v.homePollingStation || 'Central Booth'}</p>
                              {v.ward && <p className="text-[11px] text-[#2899F5]">Ward {v.ward}</p>}
                            </td>
                            <td className="px-4 py-3 font-mono text-white/70">
                              {v.assemblyConstituency || v.parliamentaryConstituency || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {v.hasVoted ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                                  <Check size={11} /> Voted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium text-[11px]">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: SEAT CANDIDATES & NOMINATIONS */}
            {activeTab === 'candidates' && (
              <div className="space-y-6">
                {/* Candidates List Section */}
                <section className="bg-[#141A2E] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Award size={18} className="text-[#2899F5]" />
                        <span>Candidates Standing in this Seat ({station.assemblyConstituency || 'Area'})</span>
                      </h3>
                      <p className="text-xs text-white/60 mt-0.5">
                        Candidates contesting in this constituency. Approved candidates appear on the official ballot.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={loadCandidates}
                      className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white border border-white/15 px-3 py-1.5 rounded-full hover:bg-white/5 transition cursor-pointer"
                    >
                      <RefreshCw size={12} className={candidatesLoading ? 'animate-spin' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {candidatesLoading ? (
                    <div className="flex justify-center py-8 text-white/40">
                      <Loader2 size={24} className="animate-spin text-[#2899F5]" />
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/15 rounded-xl text-white/50 text-xs">
                      No candidates currently registered for this seat. You can nominate candidates below.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {candidates.map((c) => (
                        <div
                          key={c._id || c.candidateId}
                          className="bg-[#0D1222] border border-white/10 rounded-xl p-4 space-y-2 relative"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-white text-sm">{c.name}</h4>
                              <p className="text-xs text-[#2899F5] font-semibold">{c.party}</p>
                            </div>
                            {c.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <Clock size={10} /> Pending Guardian Approval
                              </span>
                            ) : c.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 size={10} /> Approved on Ballot
                              </span>
                            )}
                          </div>
                          {c.manifesto && (
                            <p className="text-xs text-white/60 italic line-clamp-2">
                              &ldquo;{c.manifesto}&rdquo;
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/5">
                            <span>Candidate #{c.candidateId}</span>
                            {c.stationName && <span>Nominated by {c.stationName}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Nominate Candidate Form */}
                <section className="bg-[#141A2E] border border-white/10 rounded-2xl p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <UserPlus size={18} className="text-[#2899F5]" />
                      <span>Nominate Candidate for This Seat</span>
                    </h3>
                    <p className="text-xs text-white/60 mt-0.5">
                      Station officers can nominate a local candidate for {station.assemblyConstituency || station.stationName}. The nomination is queued for verification and approval by Guardians before appearing on the ballot.
                    </p>
                  </div>

                  {nominationMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        nominationMsg.type === 'success'
                          ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                          : 'bg-red-950/40 border border-red-800 text-red-300'
                      }`}
                    >
                      {nominationMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      <span>{nominationMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleNominateCandidate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">
                          Candidate Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={candidateForm.name}
                          onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
                          placeholder="e.g. Ramesh Patil"
                          className="w-full bg-[#0D1222] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2899F5]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">
                          Political Party or Independent *
                        </label>
                        <input
                          type="text"
                          required
                          value={candidateForm.party}
                          onChange={(e) => setCandidateForm({ ...candidateForm, party: e.target.value })}
                          placeholder="e.g. Independent or Party Name"
                          className="w-full bg-[#0D1222] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2899F5]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">
                          Party Code / Acronym (Optional)
                        </label>
                        <input
                          type="text"
                          value={candidateForm.partyCode}
                          onChange={(e) => setCandidateForm({ ...candidateForm, partyCode: e.target.value })}
                          placeholder="e.g. IND, BJP, INC"
                          className="w-full bg-[#0D1222] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2899F5]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">
                          Party Symbol Image URL (Optional)
                        </label>
                        <input
                          type="url"
                          value={candidateForm.symbol}
                          onChange={(e) => setCandidateForm({ ...candidateForm, symbol: e.target.value })}
                          placeholder="https://... (or leave empty)"
                          className="w-full bg-[#0D1222] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2899F5]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Candidate Manifesto / Vision Summary
                      </label>
                      <textarea
                        rows={2}
                        value={candidateForm.manifesto}
                        onChange={(e) => setCandidateForm({ ...candidateForm, manifesto: e.target.value })}
                        placeholder="Key policy promises, education/infrastructure goals..."
                        className="w-full bg-[#0D1222] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2899F5]"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={candidateSubmitting}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-6 py-2.5 transition text-xs cursor-pointer shadow-md"
                      >
                        {candidateSubmitting ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <PlusCircle size={14} />
                        )}
                        <span>Submit Nomination for Guardian Approval</span>
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </div>
        ) : (
          /* NO STATION ACTIVE - SELECT FROM REGISTERED SEATS */
          <div className="space-y-6">
            <div className="bg-[#141A2E] border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <MapPin size={20} className="text-[#2899F5]" />
                    <span>Select Polling Station to Open Desk</span>
                  </h2>
                  <p className="text-xs text-white/60 mt-1">
                    Select a registered constituency or local station to manage in-person voters and open the terminal.
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter stations by constituency name, code, district or station..."
                  className="w-full bg-[#0D1222] border border-white/15 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#2899F5]"
                />
              </div>

              {/* Seats Grid */}
              {seatsLoading ? (
                <div className="flex justify-center py-12 text-white/40">
                  <Loader2 size={28} className="animate-spin text-[#2899F5]" />
                </div>
              ) : filteredSeats.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/15 rounded-xl text-white/50 text-xs">
                  No registered stations match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredSeats.map((seat) => (
                    <div
                      key={seat._id || seat.code}
                      className="bg-[#0D1222] border border-white/10 hover:border-[#2899F5]/60 rounded-xl p-4 space-y-3 transition group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#2899F5] bg-[#2899F5]/10 px-2 py-0.5 rounded border border-[#2899F5]/20">
                              {seat.code}
                            </span>
                            <span className="text-[11px] uppercase tracking-wider text-white/50">
                              {seat.level}
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-base mt-1.5">{seat.name}</h3>
                          <p className="text-xs text-white/60">{seat.pollingStation}</p>
                          <p className="text-[11px] text-white/40 mt-0.5">
                            {[seat.district, seat.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-white/60">
                          <strong className="text-white">{seat.voterCount}</strong> registered voters
                        </span>
                        <button
                          type="button"
                          onClick={() => activateSeatDirectly(seat)}
                          disabled={activatingCode === seat.code}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-4 py-1.5 text-xs transition cursor-pointer"
                        >
                          {activatingCode === seat.code ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} />
                          )}
                          <span>Enter Station Desk</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
