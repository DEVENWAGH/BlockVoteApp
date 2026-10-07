'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Vote,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Clock,
  Landmark,
  Building2,
  TreePine,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  X,
  Sparkles,
} from 'lucide-react';
import CandidatePanel from '@/components/dashboard/CandidatePanel';

const LEVEL_SHORT = {
  assembly: 'Assembly (MLA)',
  loksabha: 'Lok Sabha (MP)',
  municipal: 'Municipal Ward',
  panchayat: 'Panchayat Ward',
  general: 'Single ballot (General)',
};

const LEVEL_ICONS = {
  assembly: Building2,
  loksabha: Landmark,
  municipal: Building2,
  panchayat: TreePine,
  general: Vote,
};

const LEVEL_TIPS = {
  assembly: {
    title: 'Assembly Election (MLA)',
    description:
      'Candidates stand per Assembly Constituency (e.g. MH-AC-188 Panvel). When a voter enters their Voter ID, the system matches their home assembly constituency so they only see their local MLA candidates.',
    seatExample: 'e.g. MH-AC-188, MH-AC-210, MH-AC-258',
  },
  loksabha: {
    title: 'Lok Sabha Election (MP)',
    description:
      'Candidates stand per Parliamentary Constituency (e.g. MH-PC-32 Maval). Voters only see MP candidates from their registered parliamentary seat.',
    seatExample: 'e.g. MH-PC-32, MH-PC-34, MH-PC-45',
  },
  municipal: {
    title: 'Municipal Ward Election',
    description:
      'Candidates stand per Municipal Ward (e.g. PANVEL-W7). Voters in that city and ward see candidates standing for their ward councilor seat.',
    seatExample: 'e.g. PANVEL-W7, PUNE-W18',
  },
  panchayat: {
    title: 'Gram Panchayat / Village Ward Election',
    description:
      'Candidates stand per Village Ward (e.g. MALKAPUR-W4). Voters belonging to that village and ward see their village panchayat candidates.',
    seatExample: 'e.g. MALKAPUR-W4, KALAMBOLI-W3',
  },
  general: {
    title: 'Single Ballot Election',
    description: 'All enrolled voters across the entire system see the exact same set of candidates.',
    seatExample: 'No seat code required',
  },
};

export default function GuardianCandidatesTab() {
  const queryClient = useQueryClient();
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTier, setNewTier] = useState('assembly');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [tierUpdating, setTierUpdating] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const { data: elections = [], isLoading: electionsLoading } = useQuery({
    queryKey: ['admin-elections-all'],
    queryFn: async () => {
      const res = await fetch('/api/admin/elections?filter=all');
      if (!res.ok) throw new Error('Failed to load elections');
      const data = await res.json();
      return data.elections || [];
    },
  });

  // Auto-select first active or draft election
  useEffect(() => {
    if (!selectedElectionId && elections.length > 0) {
      const active = elections.find((e) => e.phase === 1);
      const draft = elections.find((e) => e.phase === 0);
      setSelectedElectionId((active || draft || elections[0]).electionId);
    }
  }, [elections, selectedElectionId]);

  const selectedElection = elections.find((e) => e.electionId === selectedElectionId);
  const currentLevel = selectedElection?.level || 'assembly';
  const LevelIcon = LEVEL_ICONS[currentLevel] || Vote;
  const tip = LEVEL_TIPS[currentLevel] || LEVEL_TIPS.assembly;

  const handleCreateElection = async (e) => {
    e?.preventDefault();
    if (!newTitle.trim()) {
      setToastMsg({ type: 'error', text: 'Enter an election title (e.g. Maharashtra Vidhan Sabha 2026).' });
      return;
    }
    setCreating(true);
    setToastMsg(null);
    try {
      const res = await fetch('/api/admin/managed-elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          level: newTier,
          description: newDesc.trim() || `Official ${LEVEL_SHORT[newTier]} election`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create election');

      setToastMsg({ type: 'success', text: `Election "${newTitle.trim()}" created successfully in ${LEVEL_SHORT[newTier]} tier!` });
      setNewTitle('');
      setNewDesc('');
      setShowCreateModal(false);

      await queryClient.invalidateQueries({ queryKey: ['admin-elections-all'] });
      if (data.electionId) {
        setSelectedElectionId(data.electionId);
      }
    } catch (err) {
      setToastMsg({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleLevelChange = async (newLevel) => {
    if (!selectedElectionId || newLevel === currentLevel) return;
    setTierUpdating(true);
    setToastMsg(null);
    try {
      const res = await fetch('/api/admin/elections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: selectedElectionId,
          level: newLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update election tier');
      setToastMsg({ type: 'success', text: `Election tier changed to ${LEVEL_SHORT[newLevel]}. Candidate form and seat filters updated!` });
      await queryClient.invalidateQueries({ queryKey: ['admin-elections-all'] });
      await queryClient.invalidateQueries({ queryKey: ['candidates', 'admin', selectedElectionId] });
    } catch (err) {
      setToastMsg({ type: 'error', text: err.message });
    } finally {
      setTierUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-soft border border-hairline rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <UserPlus size={18} />
              </span>
              <h3 className="text-base font-semibold text-ink">Candidate Management Desk</h3>
            </div>
            <p className="text-xs text-body leading-relaxed max-w-2xl">
              Create and manage elections across official Indian electoral tiers: Assembly (MLA), Lok Sabha (MP), Municipal Wards, or Panchayat Wards.
              Add candidates with party symbols, and ballots will automatically filter by each voter&apos;s home constituency.
            </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            {elections.length > 0 && (
              <>
                <div className="w-full sm:w-60">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Select Election
                  </label>
                  <select
                    value={selectedElectionId}
                    onChange={(e) => setSelectedElectionId(e.target.value)}
                    disabled={electionsLoading}
                    className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition truncate"
                  >
                    {elections.map((el) => {
                      const title = el.title || el.name || 'Untitled Election';
                      const phaseLabel = el.phase === 1 ? 'Live' : el.phase === 2 ? 'Closed' : 'Draft';
                      return (
                        <option key={el.electionId} value={el.electionId}>
                          {title} ({phaseLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedElection && (
                  <div className="w-full sm:w-44">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                      Election Tier / Type
                    </label>
                    <select
                      value={currentLevel}
                      onChange={(e) => handleLevelChange(e.target.value)}
                      disabled={tierUpdating}
                      className="w-full bg-canvas border border-primary/30 rounded-lg px-3 py-2 text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    >
                      <option value="assembly">Assembly (MLA)</option>
                      <option value="loksabha">Lok Sabha (MP)</option>
                      <option value="municipal">Municipal Ward</option>
                      <option value="panchayat">Panchayat Ward</option>
                      <option value="general">Single ballot (General)</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="self-end pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
              >
                {showCreateModal ? <X size={14} /> : <Plus size={14} />}
                <span>{showCreateModal ? 'Cancel' : '+ New Election'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {toastMsg && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            toastMsg.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
              : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'
          }`}>
            {toastMsg.type === 'error' ? <AlertCircle size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Selected Tier Guide */}
        {selectedElection && (
          <div className="pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
                <LevelIcon size={13} />
                {tip.title}
              </span>
              <span className="text-muted">
                Seat format: <code className="bg-canvas px-1.5 py-0.5 rounded text-[11px] font-mono text-ink border border-hairline">{tip.seatExample}</code>
              </span>
            </div>
            <p className="text-muted text-[11px] hidden md:block">
              {tip.description}
            </p>
          </div>
        )}
      </div>

      {/* Inline Create Election Card */}
      {showCreateModal && (
        <div className="bg-surface border-2 border-primary/30 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h4 className="text-sm font-bold text-ink">Create New Election</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="text-muted hover:text-ink text-xs p-1"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreateElection} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Election Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Maharashtra Vidhan Sabha 2026, Lok Sabha 2026…"
                  className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Election Tier / Type *
                </label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value)}
                  className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="assembly">Assembly (MLA) — State legislative constituency</option>
                  <option value="loksabha">Lok Sabha (MP) — National parliamentary constituency</option>
                  <option value="municipal">Municipal Ward — City municipal corporation ward</option>
                  <option value="panchayat">Panchayat Ward — Village gram panchayat ward</option>
                  <option value="general">Single Ballot (General) — College / organization</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Description / Purpose (optional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Official general election for registered citizens"
                  className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-hairline text-xs font-semibold text-body hover:bg-surface-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
              >
                {creating ? <><Loader2 size={13} className="animate-spin" /> Creating on-chain…</> : <><Plus size={13} /> Create Election & Start Adding Candidates</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Area */}
      {selectedElection ? (
        <div className="bg-surface rounded-xl border border-hairline p-6 shadow-xs">
          <CandidatePanel
            key={`${selectedElection.electionId}-${currentLevel}`}
            slug="admin"
            electionId={selectedElection.electionId}
            level={currentLevel}
            canEdit={true}
          />
        </div>
      ) : electionsLoading ? (
        <div className="p-12 text-center text-muted text-sm border border-hairline rounded-xl flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-primary" /> Loading elections…
        </div>
      ) : (
        /* Empty State with Fast Creation */
        <div className="bg-surface border border-hairline rounded-xl p-8 md:p-12 text-center space-y-4 max-w-xl mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Vote size={24} />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-ink">No Elections Yet</h4>
            <p className="text-xs text-body max-w-md mx-auto">
              Create your first election by picking an election tier (Assembly MLA, Lok Sabha MP, Municipal Ward, or Panchayat Ward).
            </p>
          </div>

          <form onSubmit={handleCreateElection} className="text-left space-y-3 pt-2">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Election Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Maharashtra Vidhan Sabha 2026"
                className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Election Tier / Type
              </label>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="assembly">Assembly (MLA) — State Assembly</option>
                <option value="loksabha">Lok Sabha (MP) — Parliament</option>
                <option value="municipal">Municipal Ward — City Corporation</option>
                <option value="panchayat">Panchayat Ward — Village Gram Panchayat</option>
                <option value="general">Single Ballot (General)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full mt-2 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              {creating ? <><Loader2 size={13} className="animate-spin" /> Creating Election…</> : <><Plus size={14} /> Create Election & Open Candidate Desk</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
