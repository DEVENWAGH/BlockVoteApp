'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import {
  Shield, BatteryCharging, RefreshCw, LogOut,
  AlertCircle, CheckCircle, Loader2, Clock, CheckCircle2,
  UserCheck, Trophy, BarChart3, Fuel, Plus, Play, Trash2, Database
} from 'lucide-react';
import ElectionAnalyticsPanel from '@/components/ElectionAnalyticsPanel';
import ThemeToggle from '@/components/ThemeToggle';
import { signGuardianAction } from '@/lib/guardianMessage';

/** Guardians required to approve an election go-live request (1-of-N). */
const ELECTION_GO_LIVE_APPROVAL_THRESHOLD = 1;

const BADGE_GREEN = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800';
const BADGE_AMBER = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
const BADGE_BLUE = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
const BADGE_RED = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
const BADGE_PURPLE = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
const BADGE_EMERALD = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
const BADGE_INDIGO = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';

const PHASE_BADGES = {
  1: BADGE_GREEN,
  2: BADGE_BLUE,
  0: BADGE_AMBER,
};

const INPUT_CLASS =
  'w-full bg-canvas border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition';

function getNetworkBadgeClass(name) {
  if (name.includes('Sepolia')) return BADGE_PURPLE;
  if (name.includes('Hardhat')) return BADGE_BLUE;
  return BADGE_AMBER;
}

const TABS = [
  { id: 'approvals', label: 'Approvals', icon: Clock },
  { id: 'results', label: 'Public records', icon: Trophy },
  { id: 'gas', label: 'Gas', icon: BatteryCharging },
  { id: 'gov', label: 'Governance', icon: Shield },
];

function Toast({ type, msg }) {
  const isErr = type === 'error';
  const bg = isErr
    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
    : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300';
  const Icon = isErr ? AlertCircle : CheckCircle;
  return (
    <div className={`flex items-start gap-2.5 border rounded-lg p-3.5 mb-4 text-sm ${bg}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

// ── Approvals Tab ────────────────────────────────────────────────────────────
function ApprovalsTab({ account }) {
  const { signer } = useWallet();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/elections?filter=pending');
      const d = await r.json();
      setElections(d.elections || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (electionId, action) => {
    setMsg(null);
    setActioning(electionId);
    try {
      const proof = await signGuardianAction(signer, {
        action: `election:${action}`,
        target: String(electionId),
      });
      const r = await fetch('/api/admin/elections/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ electionId, action, ...proof }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setActioning(null);
  };

  const handleWipeData = async () => {
    if (!window.confirm("Are you sure you want to wipe all election and voter MongoDB data?")) return;
    setMsg(null);
    setLoading(true);
    try {
      const proof = await signGuardianAction(signer, { action: 'data:wipe' });
      const r = await fetch('/api/admin/wipe-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, ...proof }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message || 'Database wiped successfully.' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Pending Approvals</h3>
          <p className="text-xs text-body mt-0.5">One guardian approval transitions an election from Registration to live voting.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleWipeData} title="Wipe all election data" className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-full bg-red-50/50 hover:bg-red-100/50 dark:bg-red-950/30 dark:hover:bg-red-950/50 cursor-pointer">
            <Trash2 size={12} /> Wipe Data
          </button>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
            <RefreshCw size={12} /> Sync
          </button>
        </div>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas">
          <CheckCircle2 size={36} className="text-primary mx-auto mb-3" />
          <p className="text-ink font-semibold">Approvals list clear</p>
          <p className="text-body text-xs mt-1">There are no pending Go-Live requests at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {elections.map((e) => {
            const approvedBy = e.approvedBy?.length
              ? e.approvedBy
              : (e.guardianApprovedBy ? [e.guardianApprovedBy] : []);
            const approvalsCount = e.approvalsCount ?? approvedBy.length;
            const hasApproved = approvedBy.some(addr => addr.toLowerCase() === account.toLowerCase());
            return (
              <div key={e._id || e.id} className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-ink text-base">{e.title}</h4>
                    <p className="text-body text-xs mt-0.5">{e.description}</p>
                    <p className="text-muted text-[10px] mt-1 uppercase font-semibold">Org Slug: {e.orgSlug} · Ballot ID: {e.id}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold bg-surface-strong px-2.5 py-1 rounded-full text-ink">
                    Approvals: {approvalsCount} / {ELECTION_GO_LIVE_APPROVAL_THRESHOLD}
                  </span>
                </div>

                {approvedBy.length > 0 && (
                  <div className="bg-surface-soft p-3 rounded-lg border border-hairline">
                    <p className="text-[10px] font-semibold text-body uppercase tracking-wider mb-1.5">Approved Guardians</p>
                    <div className="space-y-1 font-mono text-[10px] text-body">
                      {approvedBy.map((addr, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <CheckCircle2 size={10} className="text-primary" />
                          <span>{addr}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {hasApproved ? (
                    <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Signed by You
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(e.id, 'approve')}
                      disabled={actioning === e.id}
                      className="bg-primary hover:bg-primary-active disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition shadow-sm"
                    >
                      {actioning === e.id ? 'Signing…' : 'Approve election'}
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(e.id, 'reject')}
                    disabled={actioning === e.id}
                    className="border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-semantic-down text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition"
                  >
                    Reject election
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Results Tab ──────────────────────────────────────────────────────────────
function ResultsTab() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/elections?filter=all');
      const d = await r.json();
      const list = d.elections || [];
      setElections(list);
      setSelectedElection((current) => current || list[0] || null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Public records</h3>
          <p className="text-xs text-body mt-0.5">Same 10-minute analytics as the public page, for every election.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas">
          <Trophy size={36} className="text-muted mx-auto mb-3" />
          <p className="text-ink font-semibold">No records archived</p>
          <p className="text-body text-xs mt-1">There are no elections registered on this platform.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {elections.map((e) => (
              <button
                key={e._id || e.id}
                onClick={() => setSelectedElection(e)}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  selectedElection?.id === e.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-hairline bg-canvas hover:border-body'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-semibold text-ink text-sm leading-snug">{e.title}</h4>
                  <span className={`text-[8px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0 border ${
                    PHASE_BADGES[e.phase] ?? BADGE_AMBER
                  }`}>
                    {e.phase === 1 ? 'Live' : e.phase === 2 ? 'Ended' : 'Setup'}
                  </span>
                </div>
                <p className="text-body text-[11px] mt-1.5 truncate">{e.description}</p>
                <p className="text-[10px] text-muted font-mono mt-1">ID: {String(e.id).slice(0, 15)}...</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8">
            {selectedElection ? (
              <ElectionAnalyticsPanel electionId={selectedElection.id} />
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center py-16 border border-dashed border-hairline rounded-xl">
                <BarChart3 size={36} className="text-muted mb-2" />
                <p className="text-body text-xs font-semibold">Select an election to open its public analytics.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gas Logistics Tab ─────────────────────────────────────────────────────────
function GasTab() {
  const [gasData, setGasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [funding, setFunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/gas');
      const d = await r.json();
      setGasData(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const triggerFunding = () => {
    window.open('https://cloud.google.com/application/web3/faucet/ethereum/sepolia', '_blank');
  };

  const getGasStatus = (balanceStr) => {
    const bal = parseFloat(balanceStr || '0');
    if (bal >= 0.1) {
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${BADGE_EMERALD}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Healthy Reserve
        </span>
      );
    } else if (bal > 0.02) {
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${BADGE_AMBER}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Low Reserve
        </span>
      );
    } else {
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${BADGE_RED}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Action Required
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Gas Logistics</h3>
          <p className="text-xs text-body mt-0.5">Monitor system reserves for Relayer node voter transactions.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Relayer Reserve */}
            <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-body uppercase tracking-wider mb-4 flex items-center gap-2">
                <Fuel size={14} className="text-primary" /> Relayer Gas Reserve
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Account Address</span>
                  <code className="text-ink font-mono text-xs">{gasData?.relayerAddress}</code>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Current Balance</span>
                  <span className="text-ink font-bold font-mono text-xs">{gasData?.relayerBalanceETH} ETH</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Reserve Status</span>
                  {getGasStatus(gasData?.relayerBalanceETH)}
                </div>
              </div>
            </div>

            {/* Gas Station Multisig */}
            <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-body uppercase tracking-wider mb-4 flex items-center gap-2">
                <Database size={14} className="text-primary" /> Gas Station Reserve
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Account Address</span>
                  <code className="text-ink font-mono text-xs">{gasData?.gasStationAddress}</code>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Current Balance</span>
                  <span className="text-ink font-bold font-mono text-xs">{gasData?.gasStationBalanceETH} ETH</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Reserve Status</span>
                  {getGasStatus(gasData?.gasStationBalanceETH)}
                </div>
              </div>
            </div>

          </div>

          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm text-center space-y-4">
            <h4 className="text-sm font-semibold text-ink">Refuel System Gas Station</h4>
            <p className="text-body text-xs max-w-md mx-auto">
              If reserves run low, request Sepolia testnet ETH from the official Google Cloud Web3 Faucet to maintain uninterrupted voter validation relays.
            </p>
            <button
              onClick={triggerFunding}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-active text-white text-xs font-semibold px-6 py-2.5 rounded-full cursor-pointer shadow-sm transition"
            >
              <Fuel size={12} />
              <span>Get Sepolia ETH (Faucet)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Governance Tab ────────────────────────────────────────────────────────────
function GovTab() {
  const { contract, readContract, account } = useWallet();
  const [govData, setGovData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [proposalCount, setProposalCount] = useState(0);
  const [proposals, setProposals] = useState([]);
  
  // Propose Upgrade State
  const [newImpl, setNewImpl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/governance');
      const d = await r.json();
      setGovData(d);

      if (readContract) {
        // Read version
        try {
          const ver = await readContract.version();
          setCurrentVersion(ver);
        } catch (e) {
          console.warn('version error:', e);
        }

        // Read proposal count
        try {
          const pCount = await readContract.proposalCount();
          setProposalCount(Number(pCount));
          
          const props = [];
          for (let i = 0; i < Number(pCount); i++) {
            const p = await readContract.getUpgradeProposal(i);
            // p is: [address impl, uint256 approvals, bool executed]
            let approvedByMe = false;
            if (account) {
              approvedByMe = await readContract.hasGuardianApproved(i, account);
            }
            props.push({
              id: i,
              impl: p[0] || p.impl,
              approvals: Number(p[1] || p.approvals),
              executed: p[2] || p.executed,
              approvedByMe,
            });
          }
          setProposals(props.reverse()); // Show newest first
        } catch (e) {
          console.warn('proposals read error:', e);
        }
      }
    } catch {}
    setLoading(false);
  }, [readContract, account]);

  useEffect(() => { load(); }, [load]);

  const handlePropose = async (e) => {
    e.preventDefault();
    if (!newImpl || !contract) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const tx = await contract.proposeUpgrade(newImpl);
      setMsg({ type: 'success', text: 'Upgrade Proposed. Waiting for transaction confirmation...' });
      await tx.wait();
      setMsg({ type: 'success', text: 'Upgrade proposed successfully on-chain! Guardians must now co-sign.' });
      setNewImpl('');
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.reason || err.message || 'Upgrade proposal failed.' });
    }
    setSubmitting(false);
  };

  const handleApprove = async (id) => {
    if (!contract) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const tx = await contract.approveUpgrade(id);
      setMsg({ type: 'success', text: 'Signing approval... Please confirm in MetaMask.' });
      await tx.wait();
      setMsg({ type: 'success', text: `Proposal #${id} approved successfully!` });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.reason || err.message || 'Approval transaction failed.' });
    }
    setSubmitting(false);
  };

  const handleExecute = async (id) => {
    if (!contract) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const tx = await contract.executeUpgrade(id);
      setMsg({ type: 'success', text: 'Executing UUPS upgrade transaction...' });
      await tx.wait();
      setMsg({ type: 'success', text: `UUPS upgrade executed successfully! Proxy contract logic is now upgraded.` });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.reason || err.message || 'Execution transaction failed.' });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Governance & UUPS Protocol</h3>
          <p className="text-xs text-body mt-0.5">Underlying Solidity smart contracts config parameters & live upgrade portal.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="space-y-6">
          {/* Specs */}
          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4 text-sm">
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">Platform Proxy Address</span>
              <code className="text-ink font-mono text-xs select-all">{govData?.contractAddress}</code>
            </div>
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">UUPS Implementation Address</span>
              <code className="text-ink font-mono text-xs select-all">{govData?.implementationAddress}</code>
            </div>
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">Contract Version</span>
              <span className="text-primary font-bold font-mono text-xs">v{currentVersion}</span>
            </div>
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">Multi-Sig Co-signers</span>
              <span className="text-ink font-mono font-medium">{govData?.guardiansCount || 3} Guardians</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted font-medium">Consensus Threshold</span>
              <span className="text-ink font-mono font-medium">{govData?.threshold || 2} Signatures</span>
            </div>
          </div>

          {/* Propose Form */}
          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-ink text-sm">Propose New Implementation</h4>
              {govData?.implementationAddress && currentVersion !== '1.0.0' && (
                <button
                  type="button"
                  onClick={() => {
                    setNewImpl(govData.implementationAddress);
                    setMsg({ type: 'success', text: `V1 Address pre-filled: ${govData.implementationAddress}. Click 'Submit Proposal' to initiate the rollback.` });
                  }}
                  className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                >
                  ↩️ Rollback to V1
                </button>
              )}
            </div>
            <form onSubmit={handlePropose} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                placeholder="Paste V2 Implementation Address (0x...)"
                value={newImpl}
                onChange={(e) => setNewImpl(e.target.value)}
                disabled={submitting}
                className={`flex-1 ${INPUT_CLASS} rounded-full text-xs`}
              />
              <button
                type="submit"
                disabled={submitting || !contract}
                className="bg-primary hover:bg-primary-active disabled:opacity-50 text-white text-xs font-semibold px-6 py-2.5 rounded-full cursor-pointer shadow-sm transition"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : 'Submit Proposal'}
              </button>
            </form>
          </div>

          {/* Upgrade Proposals List */}
          <div className="space-y-4">
            <h4 className="font-semibold text-ink text-sm">Active Upgrade Proposals ({proposalCount})</h4>
            {proposals.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-hairline rounded-xl bg-canvas text-body text-xs">
                No contract upgrade proposals registered yet.
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((p) => (
                  <div key={p.id} className="bg-canvas border border-hairline rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">Proposal #{p.id}</span>
                        {p.executed ? (
                          <span className={`text-[10px] border font-semibold px-2 py-0.5 rounded-full ${BADGE_GREEN}`}>
                            Executed (Logic Upgraded)
                          </span>
                        ) : p.approvals >= 2 ? (
                          <span className={`text-[10px] border font-semibold px-2 py-0.5 rounded-full animate-pulse ${BADGE_INDIGO}`}>
                            Ready to Execute
                          </span>
                        ) : (
                          <span className={`text-[10px] border font-semibold px-2 py-0.5 rounded-full ${BADGE_AMBER}`}>
                            Pending Consensuses ({p.approvals}/2)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-body">
                        New Logic Address: <code className="font-mono bg-surface-soft px-1.5 py-0.5 rounded text-ink text-[10px]">{p.impl}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!p.executed && (
                        <>
                          {p.approvedByMe ? (
                            <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={11} /> Approved
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApprove(p.id)}
                              disabled={submitting}
                              className="bg-primary hover:bg-primary-active text-white text-xs font-semibold px-4 py-1.5 rounded-full cursor-pointer transition shadow-sm"
                            >
                              Approve
                            </button>
                          )}
                          {p.approvals >= 2 && (
                            <button
                              onClick={() => handleExecute(p.id)}
                              disabled={submitting}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full cursor-pointer transition shadow-sm"
                            >
                              Execute Upgrade
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const { account, readContract, provider, disconnect } = useWallet();
  const [guardian, setGuardian] = useState(null);
  const [activeTab, setActiveTab] = useState('approvals');
  const [guardiansList, setGuardiansList] = useState([]);
  const [networkName, setNetworkName] = useState('Checking network...');

  // Get network name from active MetaMask provider
  useEffect(() => {
    if (provider) {
      provider.getNetwork()
        .then(net => {
          const chainId = Number(net.chainId);
          if (chainId === 11155111) {
            setNetworkName(`Sepolia Testnet (ID: ${chainId})`);
          } else if (chainId === 1337 || chainId === 31337) {
            setNetworkName(`Hardhat Local (ID: ${chainId})`);
          } else {
            setNetworkName(net.name || `Chain ${chainId}`);
          }
        })
        .catch(() => setNetworkName('Unknown Network'));
    } else {
      setNetworkName('Offline (RPC default)');
    }
  }, [provider]);

  // Fetch latest guardians list from contract
  useEffect(() => {
    if (readContract && typeof readContract.getGuardians === 'function') {
      readContract.getGuardians()
        .then(list => {
          if (list?.length === 3) setGuardiansList(list);
        })
        .catch(err => console.warn(err));
    }
  }, [readContract]);

  // Sync MetaMask account changes with sessionStorage guardian profile
  useEffect(() => {
    if (!account) {
      // If wallet disconnected, check if we have a session, otherwise redirect
      const address = sessionStorage.getItem('active_guardian_address');
      const id = sessionStorage.getItem('active_guardian_id');
      if (!address || !id) {
        router.replace('/admin-auth');
      } else {
        setGuardian({ id, address });
      }
      return;
    }

    const checkAccount = () => {
      const list = guardiansList.length > 0 ? guardiansList : [
        process.env.NEXT_PUBLIC_GUARDIAN_1 || '0xcda674D670C0b9Fc8C5037a21F00C8D7Db380f9A',
        process.env.NEXT_PUBLIC_GUARDIAN_2 || '0xBf0353eA5cD869e3707B326722Cf8492A0201fbB',
        process.env.NEXT_PUBLIC_GUARDIAN_3 || '0x7b359a8ca8a9419d6Ed0392641B6BE18df79dE84'
      ];
      const idx = list.findIndex(g => g.toLowerCase() === account.toLowerCase());

      if (idx !== -1) {
        const gId = String(idx + 1);
        sessionStorage.setItem('active_guardian_id', gId);
        sessionStorage.setItem('active_guardian_address', account);
        setGuardian({ id: gId, address: account });
      } else {
        // If switched to an unauthorized account, boot to auth gate
        sessionStorage.removeItem('active_guardian_id');
        sessionStorage.removeItem('active_guardian_address');
        setGuardian(null);
        router.replace('/admin-auth');
      }
    };

    checkAccount();
  }, [account, guardiansList, router]);

  const handleLogout = () => {
    sessionStorage.removeItem('active_guardian_id');
    sessionStorage.removeItem('active_guardian_address');
    disconnect();
    router.replace('/admin-auth');
  };

  if (!guardian) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const shortAddress = guardian.address
    ? `${guardian.address.slice(0, 6)}…${guardian.address.slice(-4)}`
    : '';

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-20 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-ink text-base leading-tight">Guardian</h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">Block Vote</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <span className={`hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border max-w-[220px] truncate ${getNetworkBadgeClass(networkName)}`} title={networkName}>
            {networkName}
          </span>
          <span className="hidden sm:inline-flex items-center gap-2 text-xs text-body bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-medium">
            <UserCheck size={14} className="text-primary shrink-0" />
            <span>Guardian {guardian.id}</span>
            <span className="font-mono text-muted">{shortAddress}</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-semantic-down border border-hairline bg-canvas hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-full"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </nav>

      <main className="px-6 md:px-16 py-12 max-w-7xl mx-auto w-full">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-display font-normal tracking-tight text-ink mb-3">Guardian desk</h2>
          <p className="text-body text-sm leading-relaxed">
            Approve elections, open public analytics, and check the gas wallet.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border transition-all ${
                  active
                    ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                    : 'bg-canvas text-body border-hairline hover:border-body'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'approvals' && <ApprovalsTab account={guardian.address} />}
        {activeTab === 'results' && <ResultsTab />}
        {activeTab === 'gas' && <GasTab />}
        {activeTab === 'gov' && <GovTab />}
      </main>
    </div>
  );
}
