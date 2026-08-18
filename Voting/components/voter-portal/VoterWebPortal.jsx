'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Smartphone,
  Vote,
} from 'lucide-react';
import PartySymbol from '@/components/PartySymbol';
import WebFaceCapture from '@/components/voter-portal/WebFaceCapture';

const STEPS = ['election', 'email', 'capture', 'candidate', 'otp', 'success'];

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

export default function VoterWebPortal({ initialElectionId = '' }) {
  const [step, setStep] = useState('election');
  const [electionId, setElectionId] = useState(initialElectionId || '');
  const [captureKey, setCaptureKey] = useState(0);
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [liveElections, setLiveElections] = useState([]);
  const [email, setEmail] = useState('');
  const [nullifierHash, setNullifierHash] = useState('');
  const [biometricToken, setBiometricToken] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [otp, setOtp] = useState('');
  const [revealCandidate, setRevealCandidate] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialElectionId) {
      openElection(initialElectionId, { silent: false });
    }
    fetch('/api/elections/public')
      .then((r) => r.json())
      .then((data) => setLiveElections(data.elections || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialElectionId]);

  const setErr = (msg) => setError(msg || '');

  const openElection = useCallback(async (id, { silent } = {}) => {
    const eid = (id || '').trim();
    if (!eid) {
      setErr('Enter the election ID from your invite.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/elections/${encodeURIComponent(eid)}`);
      const data = await res.json();
      if (!res.ok || !data.data) {
        throw new Error(data.error || 'Election not found.');
      }
      const e = data.data;
      if (e.phase !== 1 || !e.guardianApproved) {
        throw new Error('This election is not open for voting yet.');
      }
      let list = normalizeCandidates(e.candidates);
      if (list.length === 0) {
        const candRes = await fetch(
          `/api/org/admin/elections/${encodeURIComponent(e.electionId || eid)}/candidates`,
        );
        const candData = await candRes.json();
        list = normalizeCandidates(candData.candidates);
      }
      if (list.length === 0) {
        throw new Error('No candidates are listed for this election yet.');
      }
      setElectionId(e.electionId || eid);
      setElection(e);
      setCandidates(list);
      setSelectedCandidateId('');
      setBiometricToken('');
      setNullifierHash('');
      setOtp('');
      setStep('email');
    } catch (err) {
      if (!silent) setErr(err.message || 'Could not open this election.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.txHash) {
        throw new Error(data.error || 'Vote failed.');
      }
      setTxHash(data.txHash);
      setVerifyUrl(data.verifyUrl || `/verify?txHash=${encodeURIComponent(data.txHash)}`);
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
      setStep('election');
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

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white" style={{ colorScheme: 'dark' }}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0F1D]/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#0078D4] flex items-center justify-center shrink-0">
              <Vote size={15} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-none truncate">BlockVote</p>
              <p className="text-[11px] text-[#2899F5] font-semibold uppercase tracking-wider mt-1">
                Web beta
              </p>
            </div>
          </div>
          <a
            href={electionId ? `blockvote://vote/${encodeURIComponent(electionId)}` : 'blockvote://vote/'}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2899F5] hover:text-white shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5] rounded-full px-2 py-1"
          >
            <Smartphone size={16} aria-hidden="true" />
            Use the app
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-24">
        <div className="rounded-2xl border border-[#2899F5]/25 bg-[#1A1F2C] px-4 py-3 mb-8 flex gap-3">
          <Shield className="text-[#2899F5] shrink-0 mt-0.5" size={18} aria-hidden="true" />
          <p className="text-sm text-white/75 leading-relaxed">
            Prefer the Android app. It can scan the room with motion sensors while you vote.
            This web beta goes straight to a webcam capture — laptops have no surrounding monitor.
          </p>
        </div>

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
            Back
          </button>
        )}

        {election && step !== 'election' && (
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2899F5] mb-2">
            {election.title}
          </p>
        )}

        {step === 'election' && (
          <section className="space-y-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-pretty">
              Open your ballot
            </h1>
            <p className="text-white/65 max-w-xl">
              Paste the election ID from your invite, or pick a live election below.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openElection(electionId);
              }}
              className="space-y-4"
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Election ID
                </span>
                <input
                  name="electionId"
                  autoComplete="off"
                  spellCheck={false}
                  value={electionId}
                  onChange={(e) => setElectionId(e.target.value)}
                  placeholder="0x… or election id"
                  className="w-full rounded-xl bg-[#12182A] border border-white/12 focus:border-[#2899F5] px-4 py-3 outline-none text-sm font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto rounded-full bg-[#0078D4] hover:bg-[#2899F5] disabled:opacity-50 text-white font-semibold px-6 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
              >
                {loading ? 'Opening…' : 'Continue to vote'}
              </button>
            </form>

            {liveElections.length > 0 && (
              <div className="space-y-3 pt-4">
                <h2 className="text-sm font-semibold text-white/80">Live on chain</h2>
                <ul className="space-y-2">
                  {liveElections.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openElection(item.id)}
                        className="w-full text-left rounded-xl border border-white/10 bg-[#1A1F2C] hover:border-[#2899F5]/50 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
                      >
                        <span className="block font-semibold truncate">{item.title}</span>
                        {item.description ? (
                          <span className="block text-xs text-white/45 truncate mt-0.5">
                            {item.description}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {step === 'email' && (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Verify registered email</h1>
            <p className="text-white/65 mb-6">
              Use the address your election admin put on the roster.
            </p>
            <form onSubmit={submitEmail} className="space-y-4 max-w-md">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Registered email
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
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
              Direct webcam capture — no surrounding or motion-sensor step on web.
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
            <p className="text-white/65 mb-6">Your choice stays on this device until you confirm with OTP.</p>
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
                {loading ? 'Casting vote…' : 'Cast gasless vote'}
              </button>
            </form>
          </section>
        )}

        {step === 'success' && (
          <section className="text-center space-y-4 py-8">
            <CheckCircle2 className="mx-auto text-[#107C10]" size={64} aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Vote relayed on-chain</h1>
            <p className="text-white/60 text-sm">
              This screen does not restate your candidate choice.
            </p>
            {election?.title && (
              <p className="text-[#2899F5] font-semibold">{election.title}</p>
            )}
            {txHash && (
              <div className="rounded-xl bg-[#1A1F2C] border border-white/10 px-4 py-3">
                <p className="font-mono text-xs break-all text-white/85">{txHash}</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(txHash)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#2899F5]"
                >
                  <Copy size={12} aria-hidden="true" /> Copy tx hash
                </button>
              </div>
            )}
            {verifyUrl && (
              <Link href={verifyUrl} className="inline-block text-sm text-[#2899F5] hover:underline">
                Verify this ballot
              </Link>
            )}
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

        <p className="mt-10">
          <Link href="/twin-request" className="text-sm text-white/45 hover:text-[#2899F5]">
            Identical twin? Request admin verification
          </Link>
        </p>
      </main>
    </div>
  );
}
