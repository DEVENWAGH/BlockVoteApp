'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Shield,
} from 'lucide-react';
import PartySymbol from '@/components/PartySymbol';
import WebFaceCapture from '@/components/voter-portal/WebFaceCapture';
import BrandLogo from '@/components/BrandLogo';
import { requestCoarseLocation } from '@/lib/clientCoarseLocation';

/**
 * The same six steps as the Android app, in the same words:
 *   1 Enter voter ID · 2 Confirm your area · 3 Face check ·
 *   4 Choose candidate · 5 Enter code · 6 Done
 */
export const VOTER_STEPS = [
  { key: 'id', label: 'Enter voter ID' },
  { key: 'ballot', label: 'Choose candidate' },
  { key: 'face', label: 'Face check' },
  { key: 'code', label: 'Enter code' },
  { key: 'done', label: 'Done' },
];
const IDLE_RESET_MS = 2 * 60 * 1000;
const SUCCESS_RESET_SECONDS = 20;

function stepIndex(step) {
  return Math.max(0, VOTER_STEPS.findIndex((s) => s.key === step));
}

function normalizeCandidates(raw) {
  return (raw || []).map((c, i) => ({
    id: String(c.candidateId ?? c.id ?? i),
    name: c.name || 'Candidate',
    party: c.party || 'Independent',
    partyColor: c.partyColor || '',
    symbol: c.symbol || c.photoUrl || '',
    manifesto: c.manifesto || c.description || '',
    constituencyCode: c.constituencyCode || '',
  }));
}

/**
 * Polling-booth ballot. Only rendered on a computer an election admin has
 * started as a booth (see /station). The voter types their voter ID; the
 * ballot shows ONLY their home seat's candidates, no matter where this booth
 * is. A vote cast here is final and overrides any app vote.
 */
export default function VoterWebPortal({ station }) {
  const electionId = station.electionId;
  const [step, setStep] = useState('loading');
  const [captureKey, setCaptureKey] = useState(0);
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [voterId, setVoterId] = useState('');
  const [slip, setSlip] = useState(null);
  const [nullifierHash, setNullifierHash] = useState('');
  const [biometricToken, setBiometricToken] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [revealCandidate, setRevealCandidate] = useState(false);
  const [receiptCode, setReceiptCode] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [resetIn, setResetIn] = useState(SUCCESS_RESET_SECONDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [boothLocation, setBoothLocation] = useState(null);
  const idleTimer = useRef(null);
  const submittingVote = useRef(false);

  useEffect(() => {
    let cancelled = false;
    requestCoarseLocation()
      .then((location) => {
        if (!cancelled && location) setBoothLocation(location);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setErr = (msg) => setError(msg || '');

  const openElection = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/elections/${encodeURIComponent(electionId)}`);
      const data = await res.json();
      if (!res.ok || !data.data) {
        throw new Error(data.error || 'Election not found.');
      }
      const e = data.data;
      setElection(e);
      if (e.phase === 2) throw new Error('This election has closed.');
      if (e.phase !== 1 || !e.guardianApproved) {
        throw new Error('This election is not open yet.');
      }
      if (e.votingWindow && !e.votingWindow.open) {
        throw new Error(e.votingWindow.reason);
      }
      setStep('id');
    } catch (err) {
      setStep('closed');
      setErr(err.message || 'Could not open this election.');
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  const resetForNextVoter = useCallback(() => {
    setVoterId('');
    setSlip(null);
    setCandidates([]);
    setNullifierHash('');
    setBiometricToken('');
    setSelectedCandidateId('');
    setOtp('');
    setSentTo('');
    setRevealCandidate(false);
    setReceiptCode('');
    setResultMessage('');
    setResetIn(SUCCESS_RESET_SECONDS);
    setCaptureKey((k) => k + 1);
    setErr('');
    submittingVote.current = false;
    openElection();
  }, [openElection]);

  useEffect(() => {
    openElection();
  }, [openElection]);

  // Abandoned ballots are cleared so the next voter never sees someone else's session.
  useEffect(() => {
    if (step === 'loading' || step === 'closed' || step === 'done') return undefined;
    const arm = () => {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(resetForNextVoter, IDLE_RESET_MS);
    };
    arm();
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [step, resetForNextVoter]);

  useEffect(() => {
    if (step !== 'done') return undefined;
    if (resetIn <= 0) {
      resetForNextVoter();
      return undefined;
    }
    const t = window.setTimeout(() => setResetIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [step, resetIn, resetForNextVoter]);

  // Step 1 → look up the voter ID and load the HOME ballot.
  const submitVoterId = async (e) => {
    e.preventDefault();
    const clean = voterId.replace(/\s+/g, '').toUpperCase();
    if (clean.length < 4) {
      setErr('Type the voter ID printed on your voter card.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/voters/lookup?voterId=${encodeURIComponent(clean)}&electionId=${encodeURIComponent(electionId)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.nullifierHash) {
        throw new Error(data.error || 'This voter ID is not on the list. Check the ID or ask the booth officer.');
      }
      if (data.slip?.stationVoteFinal) {
        throw new Error('A vote has already been cast at a polling station for this voter. No more votes are allowed.');
      }
      const ballotRes = await fetch(
        `/api/elections/${encodeURIComponent(electionId)}/ballot?voterId=${encodeURIComponent(clean)}`,
      );
      const ballot = await ballotRes.json();
      if (!ballotRes.ok) {
        throw new Error(ballot.error || 'Could not load your ballot.');
      }
      const list = normalizeCandidates(ballot.candidates);
      if (list.length === 0) {
        throw new Error('No candidates are listed for your area yet.');
      }
      setVoterId(clean);
      setSlip({ ...data.slip, seatName: ballot.seat?.name || data.slip?.constituencyName || '' });
      setNullifierHash(data.nullifierHash);
      setCandidates(list);
      setStep('ballot');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const proceedToFaceCheck = () => {
    if (!selectedCandidateId) {
      setErr('Tap a candidate first to choose.');
      return;
    }
    setErr('');
    setStep('face');
  };

  const onFaceCaptured = async (imageDataUrl) => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/biometric/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nullifierHash, image: imageDataUrl, electionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'The face check did not pass. Look at the camera and try again.');
      }
      setBiometricToken(data.token);

      // Auto-send OTP code to voter email
      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, electionId }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) {
        throw new Error(otpData.error || 'Could not send the verification code.');
      }
      setSentTo(otpData.sentTo || slip?.maskedEmail || '');
      setRevealCandidate(false);
      setStep('code');
    } catch (err) {
      setCaptureKey((k) => k + 1);
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, electionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send the code.');
      }
      setSentTo(data.sentTo || slip?.maskedEmail || '');
      setRevealCandidate(false);
      setStep('code');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const castVote = async (e) => {
    e.preventDefault();
    if (submittingVote.current) return;
    if (otp.trim().length !== 6) {
      setErr('Enter the 6-digit code from your email.');
      return;
    }
    submittingVote.current = true;
    setLoading(true);
    setErr('');
    let location = boothLocation;
    if (!location) {
      try {
        location = await requestCoarseLocation();
        if (location) setBoothLocation(location);
      } catch {
        // Voting works without the booth's coarse location.
      }
    }
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-biometric-token': biometricToken,
        },
        body: JSON.stringify({
          voterId,
          otp: otp.trim(),
          electionId,
          candidateId: Number(selectedCandidateId),
          biometricToken,
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.txHash) {
        throw new Error(data.error || 'The vote could not be recorded. Please try again.');
      }
      setReceiptCode(data.receiptCode || data.txHash);
      setResultMessage(data.message || '');
      setResetIn(SUCCESS_RESET_SECONDS);
      setStep('done');
    } catch (err) {
      submittingVote.current = false;
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setErr('');
    if (step === 'id') return;
    if (step === 'ballot') {
      resetForNextVoter();
      return;
    }
    if (step === 'face') setStep('ballot');
    else if (step === 'code') setStep('face');
  };

  const selected = candidates.find((c) => c.id === selectedCandidateId);
  const idx = stepIndex(step);
  const hours = election?.votingWindow?.hours;
  const boothPlace = [station.district, station.state].filter(Boolean).join(', ');

  const primaryBtn =
    'w-full rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold text-lg px-6 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]';

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white" style={{ colorScheme: 'dark' }}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0F1D]/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={32} />
            <div className="min-w-0">
              <p className="font-semibold leading-none truncate">BlockVote</p>
              <p className="text-[11px] text-[#2899F5] font-semibold uppercase tracking-wider mt-1">
                Polling booth
              </p>
            </div>
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-white/70 min-w-0">
            <Landmark size={16} className="shrink-0 text-[#2899F5]" aria-hidden="true" />
            <span className="truncate">
              {station.stationName}
              {boothPlace ? ` · ${boothPlace}` : ''}
            </span>
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-24">
        <div className="rounded-2xl border border-[#2899F5]/25 bg-[#1A1F2C] px-4 py-3 mb-8 flex gap-3">
          <Shield className="text-[#2899F5] shrink-0 mt-0.5" size={18} aria-hidden="true" />
          <p className="text-sm text-white/75 leading-relaxed">
            You can vote at this booth even if your home is far away — you will see the candidates for{' '}
            <strong className="text-white">your own area</strong>. A vote cast here is{' '}
            <strong className="text-white">final</strong>: it replaces any vote from the app.
          </p>
        </div>

        {step !== 'done' && step !== 'loading' && step !== 'closed' && (
          <ol className="flex gap-1.5 mb-8" aria-label="Steps">
            {VOTER_STEPS.map((s, i) => (
              <li key={s.key} className="flex-1 min-w-0">
                <div className={`h-1.5 rounded-full ${i <= idx ? 'bg-[#2899F5]' : 'bg-white/12'}`} />
                <p className={`mt-1.5 text-[11px] truncate ${i === idx ? 'text-white' : 'text-white/40'}`}>
                  {i + 1}. {s.label}
                </p>
              </li>
            ))}
          </ol>
        )}

        {['ballot', 'face', 'code'].includes(step) && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5] rounded cursor-pointer"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {step === 'ballot' ? 'Start over' : 'Back'}
          </button>
        )}

        {election && step !== 'done' && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2899F5]">
              {election.title}
            </p>
            <p className="text-xs text-white/50">{election.status || 'Voting open'}</p>
            {hours && (
              <p className="inline-flex items-center gap-1 text-xs text-white/50">
                <Clock size={12} aria-hidden="true" />
                Voting hours: {hours}
              </p>
            )}
          </div>
        )}

        {(step === 'loading' || step === 'closed') && (
          <section className="space-y-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-pretty">
              {loading ? 'Opening the ballot…' : 'Voting is not open on this booth'}
            </h1>
            {!loading && (
              <button
                type="button"
                onClick={openElection}
                className="inline-flex items-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-6 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Check again
              </button>
            )}
          </section>
        )}

        {step === 'id' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Enter your voter ID</h1>
            <p className="text-white/65 mb-6">
              It is printed on your voter card (for example ABC1234567). Your email and face are checked next.
            </p>
            <form onSubmit={submitVoterId} className="space-y-4 max-w-md">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Voter ID</span>
                <input
                  name="voterId"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={voterId}
                  onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                  placeholder="ABC1234567"
                  maxLength={20}
                  className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-4 outline-none font-mono tracking-[0.2em] text-xl text-center uppercase"
                />
              </label>
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </section>
        )}

        {step === 'ballot' && (
          <section>
            {slip && (
              <div className="rounded-2xl border border-[#2899F5]/30 bg-gradient-to-br from-[#0D1A2E] to-[#141A2E] p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0078D4]/20 border border-[#0078D4]/40 flex items-center justify-center text-[#2899F5] font-bold text-sm">
                    {slip.name?.charAt(0) || 'V'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{slip.name}</p>
                    <p className="text-xs text-white/50 font-mono">{slip.maskedVoterId || voterId}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#0078D4]/20 text-[#2899F5] border border-[#0078D4]/30">
                    <MapPin size={12} />
                    {slip.seatName || slip.constituencyName || slip.homePlace || 'Home Area'}
                  </span>
                  {slip.hasVoted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      App vote cast · Overriding at station
                    </span>
                  )}
                </div>
              </div>
            )}

            <h1 className="text-3xl font-semibold tracking-tight mb-1">Choose your candidate</h1>
            <p className="text-white/65 mb-1">
              Candidates for <strong className="text-white">{slip?.seatName || slip?.constituencyName || 'your area'}</strong>.
            </p>
            <p className="text-white/50 text-sm mb-6">Tap a candidate to select. Face and code verification follow next.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {candidates.map((c) => {
                const selectedRow = selectedCandidateId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCandidateId(c.id)}
                    aria-pressed={selectedRow}
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5] cursor-pointer ${
                      selectedRow
                        ? 'border-[#0078D4] bg-[#0078D4]/15'
                        : 'border-white/10 bg-[#1A1F2C] hover:border-white/25'
                    }`}
                  >
                    <PartySymbol symbol={c.symbol} name={c.party} size="lg" className="!w-16 !h-16 bg-white" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold truncate">{c.name}</span>
                      <span className="block text-sm text-white/60 truncate">{c.party}</span>
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selectedRow ? 'border-[#2899F5] bg-[#2899F5]' : 'border-white/30'
                      }`}
                      aria-hidden="true"
                    >
                      {selectedRow && <CheckCircle2 size={16} className="text-[#0A0F1D]" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={proceedToFaceCheck}
              disabled={loading || !selectedCandidateId}
              className={`mt-6 ${primaryBtn}`}
            >
              {loading ? 'Processing…' : 'Proceed to Face Verification'}
            </button>
          </section>
        )}

        {step === 'face' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Face check</h1>
            <p className="text-white/65 mb-6">
              Look at the booth camera to verify your identity.
            </p>
            <WebFaceCapture key={captureKey} disabled={loading} onCaptured={onFaceCaptured} onError={setErr} />
            {loading && (
              <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Checking &amp; sending verification code…
              </p>
            )}
          </section>
        )}

        {step === 'code' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Enter the code</h1>
            <p className="text-white/65 mb-4">
              We emailed a 6-digit code to <span className="text-white">{sentTo || 'your email'}</span>.
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4 max-w-md">
              <p className="flex-1 text-sm">
                Voting for: {revealCandidate ? selected?.name || '—' : '••••••••'}
              </p>
              <button
                type="button"
                onClick={() => setRevealCandidate((v) => !v)}
                className="text-[#2899F5] p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
                aria-label={revealCandidate ? 'Hide candidate' : 'Show candidate'}
              >
                {revealCandidate ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-sm text-amber-200/90 mb-4">This is your final vote. It cannot be changed afterwards.</p>
            <form onSubmit={castVote} className="space-y-4 max-w-md">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">6-digit code</span>
                <input
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-4 outline-none font-mono tracking-[0.3em] text-center text-2xl"
                />
              </label>
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? 'Recording your vote…' : 'Confirm my vote'}
              </button>
              <button
                type="button"
                onClick={sendOtp}
                disabled={loading}
                className="w-full text-sm text-white/60 hover:text-white py-2"
              >
                Didn&apos;t get it? Send the code again
              </button>
            </form>
          </section>
        )}

        {step === 'done' && (
          <section className="text-center space-y-4 py-8">
            <CheckCircle2 className="mx-auto text-[#107C10]" size={64} aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Your vote is recorded</h1>
            {resultMessage && <p className="text-white/75 text-pretty">{resultMessage}</p>}
            <p className="text-white/60 text-sm">
              Your choice is not shown here. A receipt has been sent to your email.
            </p>
            {election?.title && <p className="text-[#2899F5] font-semibold">{election.title}</p>}
            {receiptCode && (
              <div className="rounded-xl bg-[#1A1F2C] border border-white/10 px-4 py-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Receipt code</p>
                <p className="font-mono text-xs break-all text-white/85 mt-1">{receiptCode}</p>
                <p className="text-xs text-white/45 mt-2">
                  Anyone can check this code at the Verify page to see the vote was counted — it never shows who you voted for.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={resetForNextVoter}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-6 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
            >
              Next voter
            </button>
            <p className="text-xs text-white/45" aria-live="polite">
              This booth resets automatically in {resetIn}s.
            </p>
          </section>
        )}

        {error && (
          <p
            className="mt-6 flex items-start gap-2 text-base text-red-200 bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
