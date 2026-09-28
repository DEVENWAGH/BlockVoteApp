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
  RefreshCw,
  Shield,
} from 'lucide-react';
import PartySymbol from '@/components/PartySymbol';
import WebFaceCapture from '@/components/voter-portal/WebFaceCapture';
import BrandLogo from '@/components/BrandLogo';
import { requestCoarseLocation } from '@/lib/clientCoarseLocation';

const STEPS = ['election', 'email', 'capture', 'candidate', 'otp', 'success'];
const IDLE_RESET_MS = 2 * 60 * 1000;
const SUCCESS_RESET_SECONDS = 20;

function stepIndex(step) {
  return Math.max(0, STEPS.indexOf(step));
}

function normalizeCandidates(raw) {
  return (raw || []).map((c, i) => ({
    id: String(c.candidateId ?? c.id ?? i),
    name: c.name || 'Candidate',
    party: c.party || 'Independent',
    symbol: c.symbol || c.photoUrl || '',
    manifesto: c.manifesto || c.description || '',
  }));
}

/**
 * Polling-station ballot. Only rendered on a computer an election admin has
 * activated as a station (see /station). No surroundings scan — the booth is
 * supervised. A vote cast here is final and overrides any app vote.
 */
export default function VoterWebPortal({ station }) {
  const electionId = station.electionId;
  const [step, setStep] = useState('election');
  const [captureKey, setCaptureKey] = useState(0);
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [email, setEmail] = useState('');
  const [nullifierHash, setNullifierHash] = useState('');
  const [biometricToken, setBiometricToken] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [otp, setOtp] = useState('');
  const [revealCandidate, setRevealCandidate] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [resetIn, setResetIn] = useState(SUCCESS_RESET_SECONDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [boothLocation, setBoothLocation] = useState(null);
  const [locationNote, setLocationNote] = useState('Checking this booth’s area…');
  const idleTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    requestCoarseLocation()
      .then((location) => {
        if (cancelled || !location) return;
        setBoothLocation(location);
        const place = [location.village, location.city, location.state].filter(Boolean).join(', ');
        setLocationNote(place ? `Booth area recorded: ${place}` : 'Booth area recorded');
      })
      .catch(() => {
        if (!cancelled) {
          setLocationNote('Location stayed off. Voting still works. Geography analytics skip this booth until the browser allows coarse location.');
        }
      });
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
      if (e.phase !== 1 || !e.guardianApproved) {
        throw new Error('This election is not open for voting yet.');
      }
      if (e.votingWindow && !e.votingWindow.open) {
        throw new Error(e.votingWindow.reason);
      }
      let list = normalizeCandidates(e.candidates);
      if (list.length === 0) {
        const candRes = await fetch(
          `/api/org/admin/elections/${encodeURIComponent(e.electionId || electionId)}/candidates`,
        );
        const candData = await candRes.json();
        list = normalizeCandidates(candData.candidates);
      }
      if (list.length === 0) {
        throw new Error('No candidates are listed for this election yet.');
      }
      setCandidates(list);
      setStep('email');
    } catch (err) {
      setStep('election');
      setErr(err.message || 'Could not open this election.');
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  const resetForNextVoter = useCallback(() => {
    setEmail('');
    setNullifierHash('');
    setBiometricToken('');
    setSelectedCandidateId('');
    setOtp('');
    setRevealCandidate(false);
    setTxHash('');
    setResultMessage('');
    setResetIn(SUCCESS_RESET_SECONDS);
    setCaptureKey((k) => k + 1);
    setErr('');
    openElection();
  }, [openElection]);

  useEffect(() => {
    openElection();
  }, [openElection]);

  // Abandoned ballots are cleared so the next voter never sees someone else's session.
  useEffect(() => {
    if (step === 'election' || step === 'success') return undefined;
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
    if (step !== 'success') return undefined;
    if (resetIn <= 0) {
      resetForNextVoter();
      return undefined;
    }
    const t = window.setTimeout(() => setResetIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [step, resetIn, resetForNextVoter]);

  const submitEmail = async (e) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@')) {
      setErr('Enter the email your admin registered.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/voters/lookup?email=${encodeURIComponent(clean)}&electionId=${encodeURIComponent(electionId)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.nullifierHash) {
        throw new Error(data.error || 'That email is not registered for this election.');
      }
      setNullifierHash(data.nullifierHash);
      setStep('capture');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onFaceCaptured = async (imageDataUrl) => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/biometric/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifierHash,
          image: imageDataUrl,
          electionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Face verification failed. Recapture and try again.');
      }
      setBiometricToken(data.token);
      setStep('candidate');
    } catch (err) {
      setCaptureKey((k) => k + 1);
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!selectedCandidateId) {
      setErr('Select a candidate first.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), electionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send the email OTP.');
      }
      setRevealCandidate(false);
      setStep('otp');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const castVote = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setErr('Enter the 6-digit OTP from your email.');
      return;
    }
    setLoading(true);
    setErr('');
    let location = boothLocation;
    if (!location) {
      try {
        location = await requestCoarseLocation();
        if (location) {
          setBoothLocation(location);
          const place = [location.village, location.city, location.state].filter(Boolean).join(', ');
          setLocationNote(place ? `Booth area recorded: ${place}` : 'Booth area recorded');
        }
      } catch {
        setLocationNote('Location stayed off. Voting still works. Geography analytics skip this booth until the browser allows coarse location.');
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
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          electionId,
          candidateId: Number(selectedCandidateId),
          biometricToken,
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.txHash) {
        throw new Error(data.error || 'Vote failed.');
      }
      setTxHash(data.txHash);
      setResultMessage(data.message || '');
      setResetIn(SUCCESS_RESET_SECONDS);
      setStep('success');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setErr('');
    if (step === 'email') {
      resetForNextVoter();
      return;
    }
    if (step === 'capture') {
      setStep('email');
      return;
    }
    if (step === 'candidate') {
      setStep('capture');
      return;
    }
    if (step === 'otp') {
      setStep('candidate');
    }
  };

  const selected = candidates.find((c) => c.id === selectedCandidateId);
  const idx = stepIndex(step);
  const hours = election?.votingWindow?.hours;

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white" style={{ colorScheme: 'dark' }}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0F1D]/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={32} />
            <div className="min-w-0">
              <p className="font-semibold leading-none truncate">BlockVote</p>
              <p className="text-[11px] text-[#2899F5] font-semibold uppercase tracking-wider mt-1">
                Polling station
              </p>
            </div>
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-white/70 min-w-0">
            <Landmark size={16} className="shrink-0 text-[#2899F5]" aria-hidden="true" />
            <span className="truncate">{station.stationName}</span>
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-24">
        <div className="rounded-2xl border border-[#2899F5]/25 bg-[#1A1F2C] px-4 py-3 mb-8 flex gap-3">
          <Shield className="text-[#2899F5] shrink-0 mt-0.5" size={18} aria-hidden="true" />
          <p className="text-sm text-white/75 leading-relaxed">
            Official polling booth — no room scan is needed here. A vote cast at this station is{' '}
            <strong className="text-white">final</strong>: it replaces any vote you made in the app and
            cannot be changed afterwards.
          </p>
        </div>
        <p className="text-xs text-white/55 mb-6 leading-relaxed">{locationNote}</p>

        {step !== 'success' && (
          <div className="flex gap-1.5 mb-8" aria-hidden="true">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${i <= idx ? 'bg-[#2899F5]' : 'bg-white/12'}`}
              />
            ))}
          </div>
        )}

        {step !== 'election' && step !== 'success' && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5] rounded"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {step === 'email' ? 'Start over' : 'Back'}
          </button>
        )}

        {election && step !== 'success' && (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2899F5]">
              {election.title}
            </p>
            {hours && (
              <p className="inline-flex items-center gap-1 text-xs text-white/50">
                <Clock size={12} aria-hidden="true" />
                Voting hours: {hours}
              </p>
            )}
          </div>
        )}

        {step === 'election' && (
          <section className="space-y-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-pretty">
              {loading ? 'Opening ballot…' : 'Ballot not available'}
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

        {step === 'email' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Verify registered email</h1>
            <p className="text-white/65 mb-6">
              Use the address your election admin put on the roster. You will get a one-time code there.
            </p>
            <form onSubmit={submitEmail} className="space-y-4 max-w-md">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Registered email
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@org.edu"
                  className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-3 outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-6 py-3 transition-colors"
              >
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </section>
        )}

        {step === 'capture' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Capture your face</h1>
            <p className="text-white/65 mb-6">
              Look at the booth camera. Only you should be in the frame.
            </p>
            <WebFaceCapture
              key={captureKey}
              disabled={loading}
              onCaptured={onFaceCaptured}
              onError={setErr}
            />
            {loading && (
              <p className="mt-4 flex items-center gap-2 text-sm text-white/70">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Verifying face…
              </p>
            )}
          </section>
        )}

        {step === 'candidate' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Select your candidate</h1>
            <p className="text-white/65 mb-6">Your choice stays on this screen until you confirm with OTP.</p>
            <div className="space-y-2">
              {candidates.map((c) => {
                const selectedRow = selectedCandidateId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCandidateId(c.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5] ${
                      selectedRow
                        ? 'border-[#0078D4] bg-[#0078D4]/15'
                        : 'border-white/10 bg-[#1A1F2C] hover:border-white/25'
                    }`}
                  >
                    <PartySymbol symbol={c.symbol} name={c.name} />
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{c.name}</span>
                      <span className="block text-xs text-white/50 truncate">{c.party}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={sendOtp}
              disabled={loading}
              className="mt-6 w-full rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-6 py-3 transition-colors"
            >
              {loading ? 'Sending OTP…' : 'Send email OTP'}
            </button>
          </section>
        )}

        {step === 'otp' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Confirm with email OTP</h1>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4">
              <p className="flex-1 text-sm">
                Voting for:{' '}
                {revealCandidate ? selected?.name || '—' : '••••••••'}
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
            <p className="text-sm text-amber-200/90 mb-4">
              Confirming makes this your final vote for this election.
            </p>
            <form onSubmit={castVote} className="space-y-4 max-w-md">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  6-digit OTP
                </span>
                <input
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-3 outline-none font-mono tracking-[0.3em] text-center text-lg"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-6 py-3 transition-colors"
              >
                {loading ? 'Casting vote…' : 'Cast final vote'}
              </button>
            </form>
          </section>
        )}

        {step === 'success' && (
          <section className="text-center space-y-4 py-8">
            <CheckCircle2 className="mx-auto text-[#107C10]" size={64} aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Vote recorded</h1>
            {resultMessage && <p className="text-white/75 text-pretty">{resultMessage}</p>}
            <p className="text-white/60 text-sm">
              This screen does not restate your candidate choice. Your receipt has been emailed to you.
            </p>
            {election?.title && (
              <p className="text-[#2899F5] font-semibold">{election.title}</p>
            )}
            {txHash && (
              <div className="rounded-xl bg-[#1A1F2C] border border-white/10 px-4 py-3">
                <p className="font-mono text-xs break-all text-white/85">{txHash}</p>
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
            className="mt-6 flex items-start gap-2 text-sm text-red-300 bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
