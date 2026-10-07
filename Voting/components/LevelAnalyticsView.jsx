'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Building2,
  Building,
  Trees,
  Users,
  Vote,
  Smartphone,
  MapPin,
  Search,
  RefreshCw,
  Loader2,
  Award,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  Globe,
} from 'lucide-react';

const TIER_TABS = [
  { key: 'all', label: 'All Levels', href: '/analytics', icon: BarChart3 },
  { key: 'assembly', label: 'Assembly (MLA)', href: '/analytics/assembly', icon: Landmark, badge: 'MLA' },
  { key: 'loksabha', label: 'Lok Sabha (MP)', href: '/analytics/loksabha', icon: Building2, badge: 'MP' },
  { key: 'municipal', label: 'Municipal Ward', href: '/analytics/municipal', icon: Building, badge: 'Ward' },
  { key: 'panchayat', label: 'Panchayat Ward', href: '/analytics/panchayat', icon: Trees, badge: 'Panchayat' },
];

export default function LevelAnalyticsView({ currentLevel = 'assembly' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/analytics/level/${currentLevel}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setError('');
      } else {
        setError(json.error || 'Failed to load level analytics.');
      }
    } catch {
      setError('Connection to analytics service lost.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentLevel]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const levelInfo = data?.level;
  const stats = data?.stats;
  const seats = data?.seats || [];
  const parties = data?.parties || [];

  const filteredSeats = seats.filter((s) =>
    `${s.name} ${s.code} ${s.district} ${s.city} ${s.ward}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const IconComponent =
    currentLevel === 'assembly'
      ? Landmark
      : currentLevel === 'loksabha'
      ? Building2
      : currentLevel === 'municipal'
      ? Building
      : currentLevel === 'panchayat'
      ? Trees
      : BarChart3;

  return (
    <div className="space-y-8">
      {/* 1. TIER NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-4 overflow-x-auto">
        {TIER_TABS.map((tab) => {
          const isActive = tab.key === currentLevel;
          const TabIcon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20 ring-2 ring-primary/30'
                  : 'bg-surface-soft text-body hover:text-ink hover:bg-hairline-soft'
              }`}
            >
              <TabIcon size={14} className={isActive ? 'text-white' : 'text-primary'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* 2. HERO / LEVEL TITLE */}
      <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-surface-card to-surface-soft border border-hairline rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <IconComponent size={28} className="text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                {levelInfo?.tier || 'Governance Tier'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-semantic-up bg-semantic-up/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-up animate-pulse" />
                Live Turnout
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">
              {levelInfo?.title || 'Tier Analytics'}
            </h2>
            <p className="text-sm text-body mt-1 max-w-2xl leading-relaxed">
              {levelInfo?.subtitle} — {levelInfo?.description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchAnalytics(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border border-hairline hover:bg-surface-soft text-body hover:text-ink transition cursor-pointer"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-semantic-down/30 bg-semantic-down/10 p-6 text-sm text-semantic-down">
          {error}
        </div>
      ) : (
        <>
          {/* 3. KEY METRICS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Seats / Wards</p>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <IconComponent size={16} />
                </div>
              </div>
              <p className="text-3xl font-black text-ink">{stats?.totalSeats ?? 0}</p>
              <p className="text-xs text-muted">Contested in this level</p>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Roll Voters</p>
                <div className="w-8 h-8 rounded-full bg-[#0078D4]/10 flex items-center justify-center text-[#0078D4]">
                  <Users size={16} />
                </div>
              </div>
              <p className="text-3xl font-black text-ink">{stats?.totalRegisteredVoters?.toLocaleString() ?? 0}</p>
              <p className="text-xs text-muted">Registered in this tier</p>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Turnout</p>
                <div className="w-8 h-8 rounded-full bg-semantic-up/10 flex items-center justify-center text-semantic-up">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="text-3xl font-black text-semantic-up">{stats?.turnoutPercentage ?? 0}%</p>
              <div className="w-full bg-hairline rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-semantic-up h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, stats?.turnoutPercentage || 0)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ballots Cast</p>
                <div className="w-8 h-8 rounded-full bg-accent-yellow/10 flex items-center justify-center text-accent-yellow">
                  <Vote size={16} />
                </div>
              </div>
              <p className="text-3xl font-black text-ink">{stats?.totalVotesCast ?? 0}</p>
              <p className="text-xs text-muted">
                {stats?.stationVotes ?? 0} booth · {stats?.appVotes ?? 0} app
              </p>
            </div>
          </div>

          {/* 4. VOTING MOBILITY & REMOTE VOTING INSIGHT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-surface-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                <h4 className="font-bold text-sm text-ink">Remote Voting Capability</h4>
              </div>
              <p className="text-xs text-body leading-relaxed">
                Voters belonging to these <strong className="text-ink">{levelInfo?.title}</strong> seats can walk into{' '}
                <em>any</em> polling terminal nationwide. The booth loads their home seat ballot automatically.
              </p>
              <div className="pt-2 border-t border-hairline flex items-center justify-between text-xs font-semibold">
                <span className="text-muted">Remote Terminal Votes</span>
                <span className="text-primary font-mono font-bold">{stats?.remoteVotes ?? 0}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-[#0078D4]" />
                <h4 className="font-bold text-sm text-ink">Mobile App Ballots</h4>
              </div>
              <p className="text-xs text-body leading-relaxed">
                Encrypted mobile app voting using ZK nullifier cryptographic allowance (first vote + one optional change).
              </p>
              <div className="pt-2 border-t border-hairline flex items-center justify-between text-xs font-semibold">
                <span className="text-muted">Mobile App Share</span>
                <span className="text-ink font-mono font-bold">
                  {stats?.totalVotesCast > 0
                    ? `${Math.round(((stats.appVotes || 0) / stats.totalVotesCast) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Landmark size={18} className="text-semantic-up" />
                <h4 className="font-bold text-sm text-ink">In-Person Polling Booths</h4>
              </div>
              <p className="text-xs text-body leading-relaxed">
                Supervised polling terminals with biometric facial verification + OTP receipt. Station votes are final.
              </p>
              <div className="pt-2 border-t border-hairline flex items-center justify-between text-xs font-semibold">
                <span className="text-muted">Booth Station Share</span>
                <span className="text-semantic-up font-mono font-bold">
                  {stats?.totalVotesCast > 0
                    ? `${Math.round(((stats.stationVotes || 0) / stats.totalVotesCast) * 100)}%`
                    : '100%'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. SEATS & WARDS BREAKDOWN EXPLORER */}
          <div className="rounded-3xl border border-hairline bg-surface-card p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-ink flex items-center gap-2">
                  <Award size={20} className="text-primary" />
                  <span>{levelInfo?.unitPlural} Performance Breakdown</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Detailed turnout, candidate standings, and leading vote totals by {levelInfo?.unitLabel.toLowerCase()}.
                </p>
              </div>

              {/* Search filter */}
              <div className="relative min-w-[260px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${levelInfo?.unitPlural.toLowerCase()}...`}
                  className="w-full bg-surface-soft border border-hairline rounded-full pl-9 pr-4 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {filteredSeats.length === 0 ? (
              <p className="text-sm text-muted text-center py-10">
                No {levelInfo?.unitPlural.toLowerCase()} matched &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSeats.map((seat) => (
                  <div
                    key={seat.code}
                    className="rounded-2xl border border-hairline bg-surface-soft hover:border-primary/40 hover:bg-surface-card transition p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {seat.code}
                        </span>
                        <h4 className="font-bold text-base text-ink mt-1.5">{seat.name}</h4>
                        {(seat.district || seat.city || seat.state) && (
                          <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="text-primary" />
                            {[seat.ward ? `Ward ${seat.ward}` : '', seat.city, seat.district, seat.state]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-semantic-up bg-semantic-up/10 px-2.5 py-1 rounded-full">
                          {seat.turnoutPercentage}%
                        </span>
                        <p className="text-[10px] text-muted mt-1">Turnout</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted">
                        <span>
                          {seat.votesCast} voted / {seat.registeredVoters} registered
                        </span>
                        <span className="font-semibold">{seat.candidatesCount} candidates</span>
                      </div>
                      <div className="w-full bg-hairline rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, seat.turnoutPercentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Leading candidate / Contesting list */}
                    {seat.candidates && seat.candidates.length > 0 ? (
                      <div className="pt-3 border-t border-hairline space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Contesting Candidates
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {seat.candidates.slice(0, 3).map((c, i) => (
                            <div
                              key={c.id || i}
                              className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-card border border-hairline/60"
                            >
                              <div className="min-w-0 flex items-center gap-1.5 truncate">
                                <span className="font-semibold text-ink truncate">{c.name}</span>
                                <span className="text-[10px] text-muted truncate">({c.party})</span>
                              </div>
                              <span className="text-xs font-mono font-bold text-ink shrink-0 ml-2">
                                {c.voteCount} votes
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted pt-2 border-t border-hairline">
                        No candidates registered yet.
                      </p>
                    )}

                    {/* Link to station */}
                    <div className="pt-2">
                      <Link
                        href={`/station/${encodeURIComponent(seat.name.toLowerCase().replace(/\s+/g, '-'))}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-active transition"
                      >
                        <span>Open Station Desk</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. PARTY STANDINGS & VOTE SHARES */}
          {parties.length > 0 && (
            <div className="rounded-3xl border border-hairline bg-surface-card p-6 md:p-8 space-y-5 shadow-sm">
              <h3 className="text-xl font-extrabold text-ink flex items-center gap-2">
                <Award size={20} className="text-[#0078D4]" />
                <span>Party Standings ({levelInfo?.title})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {parties.map((p) => (
                  <div
                    key={p.name}
                    className="p-4 rounded-xl border border-hairline bg-surface-soft flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-sm text-ink">{p.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {p.seatsContested} seat{p.seatsContested !== 1 ? 's' : ''} contested · Leading {p.leadingSeats}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black font-mono text-ink">{p.votes}</span>
                      <p className="text-[10px] text-muted">Total votes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
