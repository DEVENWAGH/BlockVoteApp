'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  formatDate, formatAddress, serializeElection, serializeCandidate,
} from '@/lib/contract';
import {
  Loader2, Trophy, ChevronLeft, AlertCircle, Calendar, Vote, Link as LinkIcon,
  ShieldCheck, Activity, MapPinned, Users,
} from 'lucide-react';
import Link from 'next/link';
import { ethers } from 'ethers';
import ThemeToggle from '@/components/ThemeToggle';
import PartySymbol from '@/components/PartySymbol';

import contractArtifact from '@/lib/contracts/VotingV3.json';

// Read-only contract fetching (no wallet required)
function getReadContract() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
  if (!address) return null;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(address, contractArtifact.abi, provider);
}

export default function PublicElectionDetailPage() {
  const { id } = useParams();
  const [election, setElection] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [results, setResults] = useState([]);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      
      // 1. Fetch from API endpoint first
      const apiRes = await fetch(`/api/elections/${id}`);
      const apiData = await apiRes.json();
      
      let currentElection = null;
      if (apiRes.ok && apiData.data) {
        currentElection = apiData.data;
        setElection(currentElection);
      }

      try {
        const analyticsRes = await fetch(`/api/analytics/${id}?public=1`);
        const analyticsData = await analyticsRes.json();
        if (analyticsRes.ok && analyticsData.data) {
          setAnalytics(analyticsData.data);
        }
      } catch (analyticsErr) {
        console.warn('[elections/[id]] Public analytics warning:', analyticsErr.message);
      }

      // 2. Try fetching live contract details (if on-chain ID present)
      const targetId = currentElection?.electionId || id;
      const contract = getReadContract();

      if (contract && targetId?.startsWith('0x')) {
        try {
          const electionRaw = await contract.getElection(targetId);
          const e = serializeElection(electionRaw);
          setElection(prev => ({ ...prev, ...e }));

          if (e.phase === 2) {
            const resRaw = await contract.getElectionResults(targetId);
            const sortedRes = resRaw.map(serializeCandidate).sort((a, b) => b.voteCount - a.voteCount);
            setResults(sortedRes);
            
            try {
              const winnerRaw = await contract.getWinner(targetId);
              setWinner(serializeCandidate(winnerRaw));
            } catch (error_) {
              console.warn('Could not determine winner:', error_);
            }
          } else {
            await contract.getCandidates(targetId);
          }
        } catch (chainErr) {
          console.warn('[elections/[id]] Contract read warning:', chainErr.message);
        }
      }

      if (!currentElection && !contract) {
        throw new Error('Election not found');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load election details. The election ID may be invalid or cleared from database/blockchain.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!election || error) {
    return (
      <div className="min-h-screen bg-surface-soft flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-canvas border border-hairline rounded-xl p-8 max-w-md shadow-sm">
          <AlertCircle size={40} className="text-semantic-down mx-auto mb-4" />
          <p className="text-xl text-ink font-semibold mb-2">Record Not Found</p>
          <p className="text-body text-sm mb-6">{error || 'This ballot ID does not exist on-chain.'}</p>
          <Link href="/elections" className="inline-flex bg-primary hover:bg-primary-active text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-all shadow-sm">
            ← Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  const phase = election.phase;
  const analyticsStats = analytics?.stats;
  const analyticsDemographics = analytics?.demographics;
  const canonicalVoteUrl = election.canonicalVoteUrl || '';
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || '';
  const networkLabel = rpcUrl.includes('8545') ? 'Local Hardhat' : 'EVM Network';
  let phaseLabel = 'Registration';
  let phaseBadgeClass = 'text-primary bg-primary/5 border-primary/25';
  if (phase === 2) {
    phaseLabel = 'Completed';
    phaseBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (phase === 1) {
    phaseLabel = 'Voting Active';
    phaseBadgeClass = 'text-amber-700 bg-amber-50 border-amber-200';
  }
  const ageGroups = Object.entries(analyticsDemographics?.ageGroups || {});
  const genderSplit = Object.entries(analyticsDemographics?.genderSplit || {});
  const localityTypeBuckets = Object.entries(analyticsDemographics?.localityTypeBuckets || {});
  const cityTierBuckets = Object.entries(analyticsDemographics?.cityTierBuckets || {});
  const regionBuckets = Object.entries(analyticsDemographics?.regionBuckets || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const cityBuckets = Object.entries(analyticsDemographics?.cityBuckets || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const villageBuckets = Object.entries(analyticsDemographics?.villageBuckets || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const hourly = analytics?.hourlyDistribution || [];

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      
      {/* Navbar */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/elections" className="flex items-center gap-2 text-sm text-body hover:text-ink transition font-semibold">
          <ChevronLeft size={16} /> 
          <span>Elections Directory</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 text-xs text-muted bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-mono font-medium">
            BALLOT ID: {id}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="px-6 md:px-16 py-12 max-w-4xl mx-auto w-full">
        
        {/* Banner */}
        <div className="bg-canvas border border-hairline rounded-xl p-8 md:p-10 mb-8 shadow-sm relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${phase === 2 ? 'bg-linear-to-r from-emerald-400 to-primary/85' : 'bg-primary/25'}`} />
          
          <div className="mb-4">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${phaseBadgeClass}`}>
              {phaseLabel}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-display font-normal tracking-tight text-ink mb-4">{election.title}</h1>
          <p className="text-body text-base leading-relaxed mb-6 max-w-2xl">{election.description}</p>
          
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2 bg-surface-soft border border-hairline px-4 py-2 rounded-full text-body font-mono">
              <Calendar size={14} className="text-primary" />
              <span>Starts: <span className="text-ink">{formatDate(election.startTime)}</span></span>
            </div>
            <div className="flex items-center gap-2 bg-surface-soft border border-hairline px-4 py-2 rounded-full text-body font-mono">
              <Calendar size={14} className="text-primary" />
              <span>Ends: <span className="text-ink">{formatDate(election.endTime)}</span></span>
            </div>
          </div>
        </div>

        {/* Dynamic phases layout */}
        {(phase === 0 || phase === 1) && (
          <div className="space-y-6">
            <div className="text-center py-16 bg-surface-soft/40 border border-dashed border-hairline rounded-xl shadow-sm">
              <Vote size={36} className="text-muted mx-auto mb-4" />
              <h2 className="text-xl font-display font-normal text-ink mb-2">
                {phase === 0 ? 'Ballot Initialization' : 'Voting is Underway'}
              </h2>
              <p className="text-body text-sm max-w-2xl mx-auto leading-relaxed px-4">
                {phase === 0
                  ? 'The ballot registry is currently being initialized. Dynamic updates will appear here once official polling starts.'
                  : 'Ballot lines are open. To maintain voter secrecy, tallies remain hidden until the election completes. Public activity below is aggregate-only and never reveals a voter identity or candidate choice.'}
              </p>
              {phase === 1 && (
                <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4 max-w-2xl mx-auto text-xs text-primary font-semibold">
                  Please use the authentication link sent to your registered email to cast your ballot. Public pages can verify election status and turnout, but only registered voters can open the ballot.
                </div>
              )}
            </div>

            {phase === 1 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard
                    icon={<Users size={18} className="text-primary" />}
                    label="Turnout"
                    value={analyticsStats ? `${analyticsStats.totalVotes} / ${analyticsStats.registeredVoterCount}` : '—'}
                    subtext={analyticsStats ? `${analyticsStats.turnoutRate}% of registered voters` : 'Loading turnout'}
                  />
                  <MetricCard
                    icon={<Activity size={18} className="text-primary" />}
                    label="Vote velocity"
                    value={analyticsStats ? `${analyticsStats.votesPerMinute}/min` : '—'}
                    subtext={analyticsStats?.peakHour ? `Peak hour: ${new Date(analyticsStats.peakHour.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for more activity'}
                  />
                  <MetricCard
                    icon={<MapPinned size={18} className="text-primary" />}
                    label="Public geography"
                    value={regionBuckets.length ? `${regionBuckets.length} active regions` : 'Unknown'}
                    subtext="Region/city buckets only. No exact locations."
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="Chain Verification" icon={<ShieldCheck size={16} className="text-primary" />}>
                    <div className="space-y-3 text-sm">
                      <Row label="Network" value={networkLabel} />
                      <Row label="Contract" value={formatAddress(contractAddress)} monoFull={contractAddress} />
                      <Row label="Election ID" value={formatAddress(election.electionId || id)} monoFull={election.electionId || id} />
                      {election.txHash ? <Row label="Creation Tx" value={formatAddress(election.txHash)} monoFull={election.txHash} /> : null}
                      {typeof election.blockNumber === 'number' ? <Row label="Block" value={String(election.blockNumber)} /> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href="/verify" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                        <ShieldCheck size={15} /> Open audit explorer
                      </Link>
                    </div>
                  </Panel>

                  <Panel title="Voting Access" icon={<LinkIcon size={16} className="text-primary" />}>
                    <p className="text-sm text-body leading-relaxed">
                      Registered voters receive a secure invitation by email. The canonical ballot link below opens the Android app on supported phones and can fall back to the web flow.
                    </p>
                    <div className="mt-4 rounded-xl border border-hairline bg-surface-soft p-4">
                      <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">Canonical ballot link</p>
                      <p className="font-mono text-xs text-ink break-all">
                        {canonicalVoteUrl || 'Invite link unavailable'}
                      </p>
                    </div>
                  </Panel>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="Participation Trend" icon={<Activity size={16} className="text-primary" />}>
                    {hourly.length === 0 ? (
                      <p className="text-sm text-body">No live voting activity has been recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {hourly.slice(-8).map((entry) => {
                          const max = Math.max(...hourly.map((item) => item.count), 1);
                          const width = `${Math.max((entry.count / max) * 100, 8)}%`;
                          return (
                            <div key={entry.hour} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs text-body">
                                <span>{new Date(entry.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>{entry.count} votes</span>
                              </div>
                              <div className="h-2 rounded-full bg-surface-strong overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Geographic Footprint" icon={<MapPinned size={16} className="text-primary" />}>
                    {regionBuckets.length === 0 && cityBuckets.length === 0 && villageBuckets.length === 0 ? (
                      <p className="text-sm text-body">Region analytics appear after voters share coarse location (state, city, village). Exact GPS is never stored.</p>
                    ) : (
                      <div className="space-y-4">
                        {regionBuckets.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">States / regions</p>
                            {regionBuckets.map(([region, count]) => (
                              <div key={region} className="flex items-center justify-between rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm">
                                <span className="text-ink">{region}</span>
                                <span className="font-semibold text-primary">{count}</span>
                              </div>
                            ))}
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Panel title="Age Groups" icon={<Users size={16} className="text-primary" />}>
                    <BucketList items={ageGroups} />
                  </Panel>
                  <Panel title="Gender Split" icon={<Users size={16} className="text-primary" />}>
                    <BucketList items={genderSplit} />
                  </Panel>
                  <Panel title="Urban / Tier Mix" icon={<MapPinned size={16} className="text-primary" />}>
                    <div className="space-y-4">
                      <BucketList items={localityTypeBuckets} />
                      <div className="h-px bg-hairline" />
                      <BucketList items={cityTierBuckets} />
                    </div>
                  </Panel>
                </div>
              </>
            )}
          </div>
        )}

        {/* Phase 2: Completed Tally */}
        {phase === 2 && (
          <div className="space-y-8">
            
            {/* Winner Badge */}
            {winner ? (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-canvas border border-accent-yellow rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-full bg-surface-soft border border-hairline flex items-center justify-center shrink-0 text-amber-500 shadow-sm">
                  <Trophy size={28} />
                </div>
                <div className="text-center md:text-left min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-accent-yellow uppercase tracking-widest block mb-1">
                    WINNING CANDIDATE
                  </span>
                  <h2 className="text-2xl font-semibold text-ink truncate leading-tight">{winner.name}</h2>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                    <span className="text-xs font-semibold bg-surface-strong px-2.5 py-0.5 rounded-full text-ink">
                      {winner.party}
                    </span>
                    <span className="text-xs font-semibold font-mono bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                      {winner.voteCount} votes cast
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-canvas border border-hairline rounded-xl p-6 text-center text-body text-sm shadow-sm">
                No definitive winner declared (zero ballots cast or tie-break required).
              </div>
            )}

            {/* Results Grid */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Vote size={18} className="text-primary" />
                Official Audit Tallies
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((c) => {
                  const maxVotes = Math.max(...results.map(r => r.voteCount), 1);
                  const percentage = ((c.voteCount / maxVotes) * 100).toFixed(1);
                  const isWinner = winner && c.id === winner.id;
                  
                  return (
                    <div key={c.id} className={`bg-canvas border rounded-xl p-5 relative overflow-hidden shadow-sm transition-all ${
                      isWinner ? 'border-accent-yellow' : 'border-hairline hover:border-body'
                    }`}>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <PartySymbol symbol={c.symbol} name={c.name} size="md" />
                          <div>
                            <h3 className="font-semibold text-ink text-sm leading-tight">{c.name}</h3>
                            <p className="text-[11px] text-body mt-0.5">{c.party}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-mono font-normal text-ink block leading-none">
                            {c.voteCount}
                          </span>
                          <span className="text-[9px] font-semibold text-muted uppercase tracking-wider mt-1 block">Votes</span>
                        </div>
                      </div>
                      
                      {/* Spring Progress */}
                      <div className="h-2 bg-surface-strong rounded-full overflow-hidden relative z-10">
                        <motion.div
                          className={`h-full rounded-full ${isWinner ? 'bg-accent-yellow' : 'bg-primary'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

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

function Row({ label, value, monoFull }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-body">{label}</span>
      <span className={`text-right ${monoFull ? 'font-mono text-xs text-ink break-all' : 'text-ink'}`} title={monoFull || value}>
        {monoFull || value}
      </span>
    </div>
  );
}

function BucketList({ items }) {
  if (!items?.length) {
    return <p className="text-sm text-body">No aggregate data yet.</p>;
  }

  const max = Math.max(...items.map(([, count]) => Number(count) || 0), 1);
  return (
    <div className="space-y-3">
      {items.map(([label, count]) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-body">
            <span>{label}</span>
            <span>{count}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-strong overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((Number(count) / max) * 100, 8)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
