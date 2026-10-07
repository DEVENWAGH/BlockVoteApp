'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LogOut, PlusCircle, RefreshCw, Loader2, BarChart3, ChevronDown, Play, StopCircle,
  Shield, Clock, CheckCircle2, Vote, Flag, MapPinned, Users, Landmark,
} from 'lucide-react';
import ElectionResults from '@/components/ElectionResults';
import ThemeToggle from '@/components/ThemeToggle';
import BrandLogo from '@/components/BrandLogo';
import {
  FieldInput, FieldSelect, Toast, Pill, LEVELS, levelLabel, PHASE_LABELS, PHASE_COLORS, primaryBtn, secondaryBtn,
} from '@/components/dashboard/ui';
import CandidatePanel from '@/components/dashboard/CandidatePanel';
import EnrollmentPanel from '@/components/dashboard/EnrollmentPanel';
import BoothsPanel from '@/components/dashboard/BoothsPanel';
import TwinOverridesPanel from '@/components/dashboard/TwinOverridesPanel';
import ChecklistCard, { useChecklist } from '@/components/dashboard/ChecklistCard';
import PartiesPanel from '@/components/dashboard/PartiesPanel';
import SeatsPanel from '@/components/dashboard/SeatsPanel';
import RollPanel from '@/components/dashboard/RollPanel';

// Legacy path segment — org routes ignore slug after tenancy removal
const SLUG = 'admin';

const TABS = [
  { id: 'elections', label: 'Elections', icon: Vote },
  { id: 'roll', label: 'Voters', icon: Users },
  { id: 'parties', label: 'Parties', icon: Flag },
  { id: 'seats', label: 'Seats', icon: MapPinned },
];

function ApprovalBadge({ election }) {
  if (election.phase === 2) return null;
  if (election.guardianApproved) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border font-semibold bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 flex items-center gap-1">
        <Shield size={10} /> Approved
      </span>
    );
  }
  if (election.pendingApproval) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border font-semibold bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 animate-pulse">
        <Clock size={10} /> With the guardians
      </span>
    );
  }
  return null;
}

/** Expanded body of one election card. */
function ElectionDetail({ election: e, phaseLoading, onPhaseAction }) {
  const phase = e.phase ?? 0;
  const isRegistration = phase === 0;
  const isVoting = phase === 1;
  const isCompleted = phase === 2;
  const level = e.level || 'general';
  const [section, setSection] = useState('voters');

  const { data: checklist, isLoading: checklistLoading } = useChecklist(e.id, isRegistration);

  const sections = [
    { id: 'voters', label: 'Voters', icon: Users },
    { id: 'candidates', label: 'Candidates', icon: Flag },
    { id: 'booths', label: 'Booths', icon: Landmark },
    { id: 'face', label: 'Face check', icon: Shield },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-body">
        <Pill tone="info">{levelLabel(level)}</Pill>
        {e.startTime > 0 && (
          <span>
            {new Date(e.startTime * 1000).toLocaleDateString('en-IN')} → {e.endTime > 0 ? new Date(e.endTime * 1000).toLocaleDateString('en-IN') : '…'}
          </span>
        )}
        <span>· Polling hours 7:00 AM – 6:00 PM IST</span>
      </div>

      {isRegistration && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
          <ChecklistCard checklist={checklist} loading={checklistLoading} />
          <div className="flex flex-col gap-2 min-w-[240px]">
            {!e.pendingApproval && !e.guardianApproved && (
              <>
                <button
                  type="button"
                  onClick={() => onPhaseAction(e.id, 'request-live')}
                  disabled={phaseLoading === e.id || (checklist && !checklist.ready)}
                  className={primaryBtn}
                  title={checklist && !checklist.ready ? 'Finish the checklist first' : 'Ask a guardian to open voting'}
                >
                  {phaseLoading === e.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Send to guardians
                </button>
                <p className="text-[11px] text-muted text-center">A guardian checks this list and opens voting.</p>
              </>
            )}
            {e.pendingApproval && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 px-4 py-2.5 rounded-xl text-xs font-semibold">
                <Clock size={13} className="animate-pulse" /> Waiting for a guardian to open voting.
              </div>
            )}
          </div>
        </div>
      )}

      {isVoting && (
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-[280px] bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 rounded-xl p-5 text-green-700 dark:text-green-300">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Vote size={15} /> Voting open</h4>
            <p className="text-body dark:text-green-400/80 text-xs mb-3">
              Voters got an email with this app link. Booths open from the station page; anyone can vote at any booth and still see their home ballot.
            </p>
            <div className="bg-canvas border border-hairline rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <code className="text-primary text-xs font-mono truncate">{e.inviteUrl || '—'}</code>
              <button
                type="button"
                onClick={() => { if (e.inviteUrl) navigator.clipboard.writeText(e.inviteUrl); }}
                className="text-xs bg-primary hover:bg-primary-active text-white px-3 py-1.5 rounded-full font-semibold transition shrink-0 cursor-pointer"
              >
                Copy link
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (window.confirm('Close voting now? Nobody can vote after this.')) onPhaseAction(e.id, 'end-election'); }}
            disabled={phaseLoading === e.id}
            className="inline-flex items-center gap-2 bg-semantic-down hover:opacity-90 disabled:opacity-50 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition cursor-pointer shadow-sm"
          >
            {phaseLoading === e.id ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
            Close voting
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-body text-sm font-semibold">
            <CheckCircle2 size={16} className="text-primary" /> Voting closed. Results below come straight from the blockchain.
          </div>
          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
            <ElectionResults slug={SLUG} electionId={e.id} electionTitle={e.title} compact />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-hairline">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
              section === s.id ? 'border-primary text-ink' : 'border-transparent text-body hover:text-ink'
            }`}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
        {section === 'voters' && <EnrollmentPanel electionId={e.id} level={level} phase={phase} />}
        {section === 'candidates' && <CandidatePanel slug={SLUG} electionId={e.id} level={level} canEdit={isRegistration} />}
        {section === 'booths' && <BoothsPanel electionId={e.id} />}
        {section === 'face' && <TwinOverridesPanel slug={SLUG} electionId={e.id} />}
      </div>
    </div>
  );
}

function ElectionsTab() {
  const queryClient = useQueryClient();
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDefaultEndStr = () => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const emptyForm = () => ({ title: '', description: '', level: 'general', startDate: getTodayStr(), endDate: getDefaultEndStr() });
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [phaseLoading, setPhaseLoading] = useState(null);

  const { data: elections = [], isLoading } = useQuery({
    queryKey: ['elections', 'admin'],
    queryFn: async () => {
      const r = await fetch('/api/admin/managed-elections');
      const d = await r.json();
      return d.elections || [];
    },
  });

  const createElectionMutation = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch('/api/admin/managed-elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    },
    onSuccess: () => {
      setMsg({ type: 'success', text: `"${form.title}" created. Next: include voters, then add candidates.` });
      setForm(emptyForm());
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] });
    },
    onError: (e) => setMsg({ type: 'error', text: e.message }),
  });

  const handleCreate = () => {
    setMsg(null);
    createElectionMutation.mutate({
      title: form.title,
      description: form.description,
      level: form.level,
      startDate: form.startDate,
      endDate: form.endDate,
    });
  };

  const handlePhaseAction = async (electionId, action) => {
    setPhaseLoading(electionId);
    setMsg(null);
    try {
      const r = await fetch(`/api/org/${SLUG}/elections/${electionId}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['checklist', electionId] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setPhaseLoading(null);
    }
  };

  const chosenLevel = LEVELS.find((l) => l.value === form.level);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-5">
        <div>
          <h2 className="text-ink font-display font-normal text-2xl tracking-tight">Elections</h2>
          <p className="text-body text-sm mt-1">{elections.length} election{elections.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['elections', 'admin'] })} className={secondaryBtn}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button type="button" onClick={() => setShowForm((f) => !f)} className={primaryBtn}>
            <PlusCircle size={15} /> New election
          </button>
        </div>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-canvas border border-hairline rounded-xl p-6 space-y-5 overflow-hidden shadow-sm"
          >
            <h3 className="text-ink font-semibold flex items-center gap-2"><PlusCircle size={16} className="text-primary" /> New election</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldInput label="Name" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Maharashtra Assembly Election 2026" />
              <FieldSelect label="What kind of election?" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} help={chosenLevel?.help}>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </FieldSelect>
              <div className="md:col-span-2">
                <FieldInput label="Description (shown to voters)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="A short line voters will understand…" multiline />
              </div>
              <FieldInput label="First polling day" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              <FieldInput label="Last polling day" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              <div className="col-span-1 md:col-span-2 text-xs text-muted bg-surface-soft border border-hairline rounded-lg p-3 flex items-center gap-2">
                <Clock size={15} className="text-primary shrink-0" />
                <span>Polling hours are <strong>7:00 AM – 6:00 PM IST</strong> on every day between these dates.</span>
              </div>
            </div>
            <div className="flex gap-3 border-t border-hairline pt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-body hover:text-ink border border-hairline rounded-full transition cursor-pointer">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={createElectionMutation.isPending || !form.title} className={primaryBtn}>
                {createElectionMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create election'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-hairline rounded-xl bg-canvas shadow-sm">
          <BarChart3 size={40} className="text-muted mx-auto mb-3" />
          <p className="text-ink font-semibold">No elections yet</p>
          <p className="text-body text-sm mt-1">Create one, include voters from the roll, add candidates, then send it to the guardians.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {elections.map((e) => {
            const key = e._id || e.id;
            const isExpanded = expandedId === key;
            return (
              <div key={key} className={`bg-canvas border rounded-xl transition-all shadow-sm ${isExpanded ? 'border-primary/50' : 'border-hairline hover:border-body/30'}`}>
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : key)} className="w-full flex items-center justify-between p-5 text-left cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-ink font-semibold text-base truncate">{e.title}</p>
                    <p className="text-body text-xs mt-1 line-clamp-1">{levelLabel(e.level)}{e.description ? ` · ${e.description}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <ApprovalBadge election={e} />
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${PHASE_COLORS[e.phase ?? 0]}`}>
                      {PHASE_LABELS[e.phase ?? 0]}
                    </span>
                    <ChevronDown size={16} className={`text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-hairline bg-surface-soft/30"
                    >
                      <ElectionDetail election={e} phaseLoading={phaseLoading} onPhaseAction={handlePhaseAction} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('elections');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  const orgName = session.user.name || session.user.email || 'Admin';

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-20 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size={32} />
          <div className="min-w-0">
            <h1 className="font-bold text-ink text-base leading-tight">Block Vote</h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider truncate">{orgName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <span className="hidden sm:inline text-xs text-body bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-medium truncate max-w-[220px]">
            {session.user.email}
          </span>
          <button
            id="dashboard-signout-btn"
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-1.5 text-xs font-semibold text-semantic-down border border-hairline bg-canvas hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-full"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </nav>

      <div className="border-b border-hairline bg-canvas px-6 md:px-16">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition cursor-pointer ${
                tab === t.id ? 'border-primary text-ink' : 'border-transparent text-body hover:text-ink'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 md:px-16 py-10 max-w-7xl mx-auto w-full">
        {tab === 'elections' && <ElectionsTab />}
        {tab === 'roll' && <RollPanel />}
        {tab === 'parties' && <PartiesPanel />}
        {tab === 'seats' && <SeatsPanel />}
      </main>
    </div>
  );
}
