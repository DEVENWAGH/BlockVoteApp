'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ShieldAlert, ShieldCheck, Map, Users, Award, Percent } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VoterAnalytics({ slug, electionId, electionTitle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 1. Fetch demographics and analytics data
  useEffect(() => {
    if (!electionId) return;
    setLoading(true);
    setError('');
    fetch(`/api/analytics/${electionId}`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) throw new Error(res.error || 'Failed to fetch analytics');
        setData(res.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [electionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <Loader2 className="animate-spin text-primary mb-3" size={32} />
        <p className="text-xs font-semibold">Retrieving Voter Demographics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-canvas border border-red-250 rounded-xl p-5 text-sm text-semantic-down flex items-start gap-3">
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Failed to load analytics</p>
          <p className="text-xs opacity-80">{error || 'Unknown analytics retrieve error'}</p>
        </div>
      </div>
    );
  }

  const { demographics, stats } = data;
  const matchStats = demographics.genderMatchStats;

  // Max count helper for age bar sizing
  const ageCounts = Object.values(demographics.ageGroups);
  const maxAgeCount = Math.max(...ageCounts, 1);

  return (
    <div className="space-y-6">
      
      {/* Visual Analytics Title */}
      <div className="border-b border-hairline pb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-ink text-base flex items-center gap-2">
            <Users size={18} className="text-primary" />
            Voter Demographics & Geography
          </h3>
          <p className="text-xs text-body mt-0.5">Demographic statistics & voter density mapping for {electionTitle || 'this election'}.</p>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider bg-surface-strong px-2.5 py-1 rounded-full text-ink">
          Verified Nodes: {stats.totalVotes}
        </span>
      </div>

      {/* Grid of Demographics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* 1. Age Distribution (SVG Bar Chart) */}
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
            <Award size={15} className="text-indigo-500" />
            Age Distribution (Official Roster)
          </h4>
          <div className="space-y-3">
            {Object.entries(demographics.ageGroups).map(([group, count]) => {
              const pct = stats.totalVotes > 0 ? ((count / stats.totalVotes) * 100).toFixed(1) : '0.0';
              const barWidth = ((count / maxAgeCount) * 100).toFixed(1);
              return (
                <div key={group} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-ink">{group} yrs</span>
                    <span className="text-body font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-soft border border-hairline rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Biometric gender integrity check */}
        <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
              <Percent size={15} className="text-primary" />
              Biometric Validation
            </h4>
            <p className="text-xs text-body mt-1">Cross-referencing voter list genders against face-scan estimations.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            {/* Giant Circular Match Rate Gauge */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-strong"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <motion.path
                    className={matchStats.matchRate >= 90 ? "text-green-500" : matchStats.matchRate >= 75 ? "text-amber-500" : "text-red-500"}
                    strokeWidth="3.2"
                    strokeDasharray={`${matchStats.matchRate}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: `${matchStats.matchRate}, 100` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-bold font-mono text-ink">{matchStats.matchRate}%</span>
                  <p className="text-[8px] text-muted font-bold uppercase tracking-wider">Match Rate</p>
                </div>
              </div>
            </div>

            {/* Match / Mismatch statistics */}
            <div className="space-y-2 text-xs font-semibold text-body">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Matches</span>
                <span className="font-mono text-ink">{matchStats.matches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Mismatches</span>
                <span className="font-mono text-ink">{matchStats.mismatches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Uncompared</span>
                <span className="font-mono text-ink">{matchStats.unknowns}</span>
              </div>
            </div>
          </div>

          {/* Verification Status Alert */}
          {matchStats.mismatches > 0 ? (
            <div className="bg-red-50/55 border border-red-150 dark:bg-red-950/40 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="font-bold">Biometric Gender Mismatches Flagged</p>
                <p className="text-[10px] opacity-90">{matchStats.mismatches} vote(s) cast with a gender mismatch. Please review twin verification logs or audit registry logs.</p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50/50 border border-green-150 dark:bg-green-950/40 dark:border-green-800 rounded-lg p-3 text-green-700 dark:text-green-300 text-xs flex items-start gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Biometric Integrity Confirmed</p>
                <p className="text-[10px] opacity-90">All verified voters match their official roster genders perfectly.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Coarse place labels only — coordinates are never stored */}
      <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
        <h4 className="font-bold text-ink text-sm flex items-center gap-1.5">
          <Map size={15} className="text-primary" />
          Coarse place labels
        </h4>
        <p className="text-xs text-body">
          State, city, and village from the app or a polling station. Groups smaller than 5 voters are hidden. GPS coordinates are not stored.
        </p>
        <PlaceBuckets title="States / regions" buckets={demographics.regionBuckets} />
        <PlaceBuckets title="Cities" buckets={demographics.cityBuckets} />
        <PlaceBuckets title="Villages / localities" buckets={demographics.villageBuckets} />
      </div>

    </div>
  );
}

function PlaceBuckets({ title, buckets }) {
  const entries = Object.entries(buckets || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">{title}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-body">Nothing to show yet.</p>
      ) : entries.map(([label, count]) => (
        <div key={label} className="flex items-center justify-between text-xs border border-hairline rounded-lg px-3 py-2">
          <span className="text-ink">{label}</span>
          <span className="font-mono text-body">{count}</span>
        </div>
      ))}
    </div>
  );
}
