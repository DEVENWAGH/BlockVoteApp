'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, Activity, Clock, MapPinned, AlertCircle,
  RefreshCw, Loader2, ShieldCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/contract';

const REFRESH_MS = 10 * 60 * 1000;

function formatWhen(value) {
  const text = formatDate(value);
  return text || 'Not scheduled';
}

export default function ElectionAnalyticsPanel({ electionId }) {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAnalytics = useCallback(async (id, silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const analyticsRes = await fetch(`/api/analytics/${id}?public=1&delay=10`);
      const analyticsDataJson = await analyticsRes.json();

      if (analyticsDataJson.success && analyticsDataJson.data) {
        setAnalyticsData(analyticsDataJson.data);
        setError('');
      } else {
        setError(analyticsDataJson.error || 'Failed to fetch analytics.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection to analytics service lost.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setAnalyticsData(null);
    if (electionId) loadAnalytics(electionId);
  }, [electionId, loadAnalytics]);

  useEffect(() => {
    if (!electionId) return undefined;
    const interval = setInterval(() => {
      loadAnalytics(electionId, true);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [electionId, loadAnalytics]);

  if (!electionId) {
    return <p className="text-sm text-body">Select an election to see analytics.</p>;
  }

  if (loading && !analyticsData) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const stats = analyticsData?.stats;
  const hourly = analyticsData?.hourlyDistribution || [];
  const shares = analyticsData?.candidateShares;
  const demographics = analyticsData?.demographics;
  const election = analyticsData?.election;
  const countsVisible = Boolean(stats?.countsVisible);
  const phase = election?.phase;
  let phaseLabel = 'Registration';
  let phaseBadgeClass = 'text-primary bg-primary/5 border-primary/25';
  if (phase === 2) {
    phaseLabel = 'Completed';
    phaseBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (phase === 1) {
    phaseLabel = 'Voting Active';
    phaseBadgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
  }

  const regionBuckets = Object.entries(demographics?.regionBuckets || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const cityBuckets = Object.entries(demographics?.cityBuckets || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const villageBuckets = Object.entries(demographics?.villageBuckets || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ageGroups = Object.entries(demographics?.ageGroups || {});
  const genderSplit = Object.entries(demographics?.genderSplit || {});
  const localityTypeBuckets = Object.entries(demographics?.localityTypeBuckets || {});
  const hasPlaces = regionBuckets.length + cityBuckets.length + villageBuckets.length > 0;
  const locationRate = stats?.registeredVoterCount
    ? Math.round((stats.locationShared / stats.registeredVoterCount) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => loadAnalytics(electionId)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {election && (
        <div className="bg-canvas border border-hairline rounded-xl p-6 shadow-sm">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${phaseBadgeClass}`}>
            {phaseLabel}
          </span>
          <h2 className="text-2xl font-display font-normal tracking-tight text-ink mt-3">{election.title}</h2>
          {election.description ? (
            <p className="text-body text-sm leading-relaxed mt-2 max-w-2xl">{election.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-xs font-semibold mt-4">
            <div className="flex items-center gap-2 bg-surface-soft border border-hairline px-4 py-2 rounded-full text-body font-mono">
              <Clock size={14} className="text-primary" />
              <span>Started: <span className="text-ink">{formatWhen(election.startTime)}</span></span>
            </div>
            <div className="flex items-center gap-2 bg-surface-soft border border-hairline px-4 py-2 rounded-full text-body font-mono">
              <Clock size={14} className="text-primary" />
              <span>Closes: <span className="text-ink">{formatWhen(election.endTime)}</span></span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex gap-2 items-center bg-canvas border border-red-200 text-semantic-down rounded-xl p-4 text-sm">
          <AlertCircle size={16} className="shrink-0" />{error}
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-body leading-relaxed">
        <p className="flex items-start gap-2">
          <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" />
          <span>
            Turnout, place, and roster mix refresh every 10 minutes. This does not show who voted or a live winner.
            Candidate share appears only after {shares?.minimumBallots || 50} ballots are at least 10 minutes old, and then only as percentages.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<Users size={18} className="text-primary" />}
          label="Turnout"
          value={countsVisible ? `${stats.turnoutRate}%` : 'Sealed'}
          subtext={countsVisible
            ? `Share of ${stats.registeredVoterCount} registered voters. Raw ballot totals stay off this page.`
            : 'The ballot count stays hidden until the list is large enough that one vote cannot be traced.'}
        />
        <MetricCard
          icon={<Activity size={18} className="text-primary" />}
          label="Recent pace"
          value={countsVisible ? `${stats.votesPerMinute}/min` : 'Delayed'}
          subtext={stats?.peakHour
            ? `Busiest published hour: ${new Date(stats.peakHour.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Pace is published with a 10-minute delay.'}
        />
        <MetricCard
          icon={<MapPinned size={18} className="text-primary" />}
          label="Place labels"
          value={stats ? `${locationRate}%` : '—'}
          subtext={stats
            ? `${stats.locationShared} of ${stats.registeredVoterCount} voters have a state, city, or village. GPS is never stored.`
            : 'Waiting for location from the app or a polling station.'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Participation trend" icon={<Activity size={16} className="text-primary" />}>
          {hourly.length === 0 ? (
            <p className="text-sm text-body">
              Hours appear after at least 5 ballots fall in a completed hour, outside the 10-minute delay.
            </p>
          ) : (
            <BucketList items={hourly.map((entry) => [
              new Date(entry.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              entry.count,
            ])} />
          )}
        </Panel>

        <Panel title="Candidate share" icon={<BarChart3 size={16} className="text-primary" />}>
          {shares?.visible && shares.shares?.length ? (
            <div className="space-y-4">
              <p className="text-sm text-body">
                Percent of ballots cast before {formatWhen(shares.through)}. Exact counts stay off this page.
              </p>
              <BucketList items={shares.shares.map((share) => [
                share.party ? `${share.name} (${share.party})` : share.name,
                `${share.percent}%`,
              ])} numeric={false} />
            </div>
          ) : (
            <p className="text-sm text-body">
              Candidate share is hidden until {shares?.minimumBallots || 50} ballots are at least 10 minutes old, so a room cannot match a person to a choice.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Where voters are" icon={<MapPinned size={16} className="text-primary" />}>
          {!hasPlaces ? (
            <p className="text-sm text-body">
              Place names show up after the Android app or a polling-station browser shares coarse location. Groups smaller than 5 voters are left off the chart.
            </p>
          ) : (
            <div className="space-y-4">
              {regionBuckets.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">States / regions</p>
                  <BucketList items={regionBuckets} />
                </div>
              )}
              {cityBuckets.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Cities</p>
                  <BucketList items={cityBuckets} />
                </div>
              )}
              {villageBuckets.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Villages / localities</p>
                  <BucketList items={villageBuckets} />
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Roster mix" icon={<Users size={16} className="text-primary" />}>
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Age</p>
              <BucketList items={ageGroups} />
            </div>
            <div className="h-px bg-hairline" />
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Gender</p>
              <BucketList items={genderSplit} />
            </div>
            {localityTypeBuckets.length > 0 && (
              <>
                <div className="h-px bg-hairline" />
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Urban / rural</p>
                  <BucketList items={localityTypeBuckets} />
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ icon, label, value, subtext }) {
  return (
    <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-body">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-display text-ink">{value}</p>
      <p className="text-xs text-body mt-2">{subtext}</p>
    </div>
  );
}

function BucketList({ items, numeric = true }) {
  if (!items?.length) {
    return <p className="text-sm text-body">No aggregate data yet.</p>;
  }

  const amounts = items.map(([, count]) => (typeof count === 'number' ? count : 0));
  const max = Math.max(...amounts, 1);
  return (
    <div className="space-y-3">
      {items.map(([label, count]) => {
        const width = numeric
          ? `${Math.max((Number(count) / max) * 100, 8)}%`
          : `${Math.max(parseInt(String(count), 10) || 0, 8)}%`;
        return (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs text-body">
              <span className="text-ink">{label}</span>
              <span>{count}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-strong overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
