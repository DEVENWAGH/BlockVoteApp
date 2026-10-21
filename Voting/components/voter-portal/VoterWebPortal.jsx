'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Shield,
  UserCheck,
} from 'lucide-react';
import PartySymbol from '@/components/PartySymbol';
import WebFaceCapture from '@/components/voter-portal/WebFaceCapture';
import BrandLogo from '@/components/BrandLogo';
import { requestCoarseLocation } from '@/lib/clientCoarseLocation';

/**
 * Shared voter steps matching the Android app:
 *   1 Enter voter ID · 2 Check your photo · 3 Confirm your home seat ·
 *   4 Choose the symbol · 5 Enter the code from your email · 6 Done — receipt code
 */
export const VOTER_STEPS = [
  { key: 'id', label: 'Enter voter ID' },
  { key: 'face', label: 'Check your photo' },
  { key: 'slip', label: 'Confirm your home seat' },
  { key: 'ballot', label: 'Choose the symbol' },
  { key: 'code', label: 'Enter code from email' },
  { key: 'done', label: 'Done — receipt code' },
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
 * Polling-booth ballot. Rendered on an activated station computer (see /station).
 * The voter enters their voter ID; the ballot shows ONLY their home seat's candidates,
 * no matter which booth in India they are standing at.
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
  const [expandedManifestoId, setExpandedManifestoId] = useState(null);
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [revealCandidate, setRevealCandidate] = useState(false);
  const [receiptCode, setReceiptCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
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
    setExpandedManifestoId(null);
    setOtp('');
    setSentTo('');
    setRevealCandidate(false);
    setReceiptCode('');
    setCopiedCode(false);
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

  // Reset session after idle timeout
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

  // Countdown reset on Done screen
  useEffect(() => {
    if (step !== 'done') return undefined;
    if (resetIn <= 0) {
      resetForNextVoter();
      return undefined;
    }
    const t = window.setTimeout(() => setResetIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [step, resetIn, resetForNextVoter]);

  // Step 1: Look up voter ID on master roll
  const submitVoterId = async (e) => {
    e.preventDefault();
    const clean = voterId.replace(/\s+/g, '').toUpperCase();
    if (clean.length < 4) {
      setErr('Type the voter ID printed on your voter card (e.g. ABC1234567).');
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
      setVoterId(clean);
      setSlip(data.slip);
      setNullifierHash(data.nullifierHash);
      setStep('face');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Face capture & biometric token
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
        throw new Error(data.error || 'The face check did not pass. Look directly at the camera and try again.');
      }
      setBiometricToken(data.token);
      setStep('slip');
    } catch (err) {
      setCaptureKey((k) => k + 1);
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Confirm voter slip & load home ballot
  const confirmHomeSeat = async () => {
    setLoading(true);
    setErr('');
    try {
      const ballotRes = await fetch(
        `/api/elections/${encodeURIComponent(electionId)}/ballot?voterId=${encodeURIComponent(voterId)}`,
      );
      const ballot = await ballotRes.json();
      if (!ballotRes.ok) {
        throw new Error(ballot.error || 'Could not load the ballot for your home area.');
      }
      const list = normalizeCandidates(ballot.candidates);
      if (list.length === 0) {
        throw new Error('No candidates are listed for your area yet.');
      }
      setCandidates(list);
      if (ballot.seat?.name) {
        setSlip((prev) => ({ ...prev, constituencyName: ballot.seat.name, seatName: ballot.seat.name }));
      }
      setStep('ballot');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Choose candidate & send email OTP
  const proceedToCodeVerification = async () => {
    if (!selectedCandidateId) {
      setErr('Tap a candidate or their symbol to make your choice.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
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
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
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
      setErr('');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Cast vote with OTP
  const castVote = async (e) => {
    e.preventDefault();
    if (submittingVote.current) return;
    if (otp.trim().length !== 6) {
      setErr('Enter the 6-digit code sent to your email.');
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
      } catch {}
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

  // Back navigation without losing voter ID
  const goBack = () => {
    setErr('');
    if (step === 'id') return;
    if (step === 'face') setStep('id');
    else if (step === 'slip') setStep('face');
    else if (step === 'ballot') setStep('slip');
    else if (step === 'code') setStep('ballot');
  };

  const copyReceipt = () => {
    if (!receiptCode) return;
    navigator.clipboard.writeText(receiptCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  const selected = candidates.find((c) => c.id === selectedCandidateId);
  const idx = stepIndex(step);
  const hours = election?.votingWindow?.hours;
  const boothPlace = [station.district, station.state].filter(Boolean).join(', ');

  const primaryBtn =
    'w-full rounded-xl bg-[#006c49] hover:bg-[#007f56] active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-lg px-6 py-4 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]';
  const secondaryBtn =
    'w-full rounded-xl bg-transparent hover:bg-white/5 active:scale-[0.99] border border-white/20 text-white font-semibold text-base px-6 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]';

  return (
    <div className="min-h-screen bg-[#0b1c30] text-[#f8f9ff]" style={{ colorScheme: 'dark' }}>
      {/* Institutional Top App Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1c30]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size={36} />
            <div className="min-w-0">
              <p className="font-bold tracking-tight text-lg text-white leading-none">BlockVote</p>
              <p className="text-[11px] text-[#10b981] font-semibold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                Electoral Station Active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-white/80 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
            <Landmark size={15} className="shrink-0 text-[#38bdf8]" aria-hidden="true" />
            <span className="font-medium truncate">
              {station.stationName}
              {boothPlace ? ` · ${boothPlace}` : ''}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 pb-28">
        {/* Remote Home-Constituency Civic Banner */}
        <div className="rounded-2xl border border-white/10 bg-[#131b2e] p-4 mb-6 flex items-start gap-3.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#0078d4]/15 border border-[#0078d4]/30 flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="text-[#38bdf8]" size={18} aria-hidden="true" />
          </div>
          <div className="text-xs md:text-sm text-white/80 leading-relaxed">
            <strong className="text-white font-semibold">Home-Constituency Voting:</strong> A voter from any village or district in India can vote at this physical booth. Your ballot will load candidates for your{' '}
            <strong className="text-[#10b981] font-semibold">home area</strong>, and your vote is counted directly for your home seat.
          </div>
        </div>

        {/* 6-Step Linear Indicator */}
        {step !== 'done' && step !== 'loading' && step !== 'closed' && (
          <nav className="mb-8" aria-label="Electoral Steps">
            <ol className="grid grid-cols-5 gap-2">
              {VOTER_STEPS.slice(0, 5).map((s, i) => (
                <li key={s.key} className="min-w-0">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i < idx
                        ? 'bg-[#10b981]'
                        : i === idx
                        ? 'bg-[#0078d4] shadow-sm'
                        : 'bg-white/10'
                    }`}
                  />
                  <p
                    className={`mt-1.5 text-[11px] md:text-xs truncate transition-colors ${
                      i === idx
                        ? 'text-white font-semibold'
                        : i < idx
                        ? 'text-[#10b981]'
                        : 'text-white/40'
                    }`}
                  >
                    {i + 1}. {s.label}
                  </p>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Back navigation button */}
        {['face', 'slip', 'ballot', 'code'].includes(step) && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-6 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to previous step</span>
          </button>
        )}

        {/* Election Header Meta */}
        {election && step !== 'done' && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[#38bdf8] bg-[#38bdf8]/10 px-2.5 py-0.5 rounded-md border border-[#38bdf8]/20">
              {election.title}
            </span>
            <span className="text-white/60">Poll Level: {election.level || 'General'}</span>
            {hours && (
              <span className="inline-flex items-center gap-1 text-white/50">
                <Clock size={12} aria-hidden="true" />
                Hours: {hours}
              </span>
            )}
          </div>
        )}

        {/* LOADING / CLOSED STATE */}
        {(step === 'loading' || step === 'closed') && (
          <section className="bg-[#131b2e] border border-white/10 rounded-2xl p-8 text-center space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              {loading ? 'Opening the ballot system…' : 'Voting is currently closed at this station'}
            </h1>
            <p className="text-white/70 max-w-md mx-auto text-sm">
              {error || 'This election must be approved and opened by the Guardians before casting votes.'}
            </p>
            {!loading && (
              <button
                type="button"
                onClick={openElection}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0078d4] hover:bg-[#2899f5] text-white font-semibold px-6 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Check again
              </button>
            )}
          </section>
        )}

        {/* STEP 1: ENTER VOTER ID */}
        {step === 'id' && (
          <section className="bg-[#131b2e] border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Step 1 of 5</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">Enter your Voter ID</h1>
                <p className="text-white/70 text-sm mt-1">
                  Type the EPIC voter ID number printed on your physical voter card (for example ABC1234567 or MH12004582).
                </p>
              </div>

              <form onSubmit={submitVoterId} className="space-y-6">
                <div>
                  <label htmlFor="voter-id-input" className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                    Voter ID (EPIC)
                  </label>
                  <input
                    id="voter-id-input"
                    name="voterId"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={voterId}
                    onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                    placeholder="ABC1234567"
                    maxLength={20}
                    className="w-full rounded-xl bg-[#0b1c30] border-2 border-white/15 focus:border-[#38bdf8] px-4 py-4 outline-none font-mono tracking-[0.2em] text-2xl text-center uppercase text-white shadow-inner transition-colors"
                  />
                  <p className="text-xs text-white/50 mt-2 text-center">
                    Your record will be matched against the official electoral roll.
                  </p>
                </div>

                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" /> Checking Roll…
                    </span>
                  ) : (
                    'Search Voter Roll'
                  )}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* STEP 2: CHECK YOUR PHOTO */}
        {step === 'face' && (
          <section className="bg-[#131b2e] border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Step 2 of 5</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">Check your photo</h1>
                <p className="text-white/70 text-sm mt-1">
                  Look directly into the booth camera to confirm your identity against the registered roll.
                </p>
              </div>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0b1c30]">
                <WebFaceCapture key={captureKey} disabled={loading} onCaptured={onFaceCaptured} onError={setErr} />
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-[#38bdf8]">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying face biometric against official record…</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* STEP 3: CONFIRM YOUR HOME SEAT (OFFICIAL VOTER SLIP) */}
        {step === 'slip' && slip && (
          <section className="bg-[#131b2e] border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Step 3 of 5</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">Confirm your home seat</h1>
                <p className="text-white/70 text-sm mt-1">
                  Please confirm that the electoral details below match your home residence.
                </p>
              </div>

              {/* Official E-Voter Slip Card */}
              <div className="rounded-2xl border-2 border-[#10b981]/40 bg-gradient-to-b from-[#0b1c30] to-[#131b2e] p-6 shadow-xl space-y-5">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[11px] font-bold text-[#10b981] uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck size={14} /> Official E-Voter Slip
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">{slip.name}</h2>
                    <p className="font-mono text-sm text-white/70 tracking-wider mt-0.5">
                      {slip.maskedVoterId || voterId}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shrink-0">
                    Verified on Roll
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs md:text-sm">
                  <div>
                    <span className="text-white/50 block">Home Village / City</span>
                    <span className="font-semibold text-white mt-0.5 block">
                      {slip.village || slip.city || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50 block">District &amp; State</span>
                    <span className="font-semibold text-white mt-0.5 block">
                      {[slip.district, slip.state].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                  {slip.ward && (
                    <div>
                      <span className="text-white/50 block">Ward Number</span>
                      <span className="font-semibold text-white mt-0.5 block">{slip.ward}</span>
                    </div>
                  )}
                  {slip.homePollingStation && (
                    <div>
                      <span className="text-white/50 block">Home Polling Station</span>
                      <span className="font-semibold text-white mt-0.5 block truncate">
                        {slip.homePollingStation}
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary Home Seat Callout */}
                <div className="rounded-xl bg-[#0078d4]/15 border border-[#0078d4]/30 p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#0078d4]/20 flex items-center justify-center shrink-0">
                    <MapPin className="text-[#38bdf8]" size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-[#38bdf8] uppercase tracking-wider">
                      Your Ballot Constituency
                    </span>
                    <p className="text-base md:text-lg font-bold text-white truncate">
                      {slip.constituencyName || slip.seatName || 'Assembly / Parliamentary Seat'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-white/60 leading-relaxed italic">
                  Note: You are voting from physical station <strong className="text-white font-medium">{station.stationName}</strong>. Your vote will be securely recorded for your home constituency.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button type="button" onClick={confirmHomeSeat} disabled={loading} className={primaryBtn}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" /> Loading Candidates…
                    </span>
                  ) : (
                    'Yes, this is my home seat'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoterId('');
                    setSlip(null);
                    setStep('id');
                  }}
                  className={secondaryBtn}
                >
                  Not me — enter another Voter ID
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 4: CHOOSE THE SYMBOL (SYMBOL-FIRST BALLOT) */}
        {step === 'ballot' && (
          <section className="space-y-6">
            <div className="bg-[#131b2e] border border-white/10 rounded-2xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Step 4 of 5</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">Choose the symbol</h1>
                <p className="text-white/70 text-sm mt-0.5">
                  Candidates for <strong className="text-white">{slip?.constituencyName || slip?.seatName || 'your home area'}</strong>.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/50 block">Voter</span>
                <span className="text-sm font-bold text-white">{slip?.name}</span>
                <span className="text-xs text-white/50 font-mono block">{slip?.maskedVoterId}</span>
              </div>
            </div>

            {/* Symbol-First Candidate Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2" id="ballot-cards">
              {candidates.map((c) => {
                const isSelected = selectedCandidateId === c.id;
                const isExpanded = expandedManifestoId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCandidateId(c.id)}
                    className={`rounded-2xl border-2 p-5 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#10b981] bg-[#006c49]/15 shadow-lg ring-2 ring-[#10b981]/20'
                        : 'border-white/10 bg-[#131b2e] hover:border-white/25 hover:bg-[#151f33]'
                    }`}
                  >
                    {/* Top Row: Symbol prominently placed */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Prominent Symbol Box (Largest Visual Element) */}
                      <div className="w-20 h-20 rounded-2xl bg-white p-2 border border-black/10 shadow-md flex items-center justify-center shrink-0">
                        <PartySymbol symbol={c.symbol} name={c.party} size="xl" className="!w-16 !h-16" />
                      </div>

                      {/* Radio Selection Indicator */}
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'border-[#10b981] bg-[#10b981]' : 'border-white/30'
                        }`}
                      >
                        {isSelected && <Check size={18} className="text-[#0b1c30] stroke-[3]" />}
                      </div>
                    </div>

                    {/* Candidate Name & Party Badge */}
                    <div className="space-y-1.5 flex-1">
                      <h2 className="text-xl font-bold text-white tracking-tight leading-snug">{c.name}</h2>
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/90 border border-white/15">
                          {c.party}
                        </span>
                      </div>
                    </div>

                    {/* Manifesto Accordion */}
                    {c.manifesto && (
                      <div className="mt-4 pt-3 border-t border-white/10 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedManifestoId(isExpanded ? null : c.id);
                          }}
                          className="flex items-center justify-between w-full text-white/60 hover:text-white transition-colors"
                        >
                          <span className="font-semibold">Candidate Manifesto</span>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                        {isExpanded && (
                          <p className="mt-2 text-white/80 leading-relaxed bg-[#0b1c30]/60 p-2.5 rounded-lg border border-white/5">
                            {c.manifesto}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Proceed Bar */}
            <div className="bg-[#131b2e] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm">
                <span className="text-white/60">Selected: </span>
                <strong className="text-white font-bold">
                  {selected ? `${selected.name} (${selected.party})` : 'None chosen yet'}
                </strong>
              </div>
              <button
                type="button"
                onClick={proceedToCodeVerification}
                disabled={loading || !selectedCandidateId}
                className="rounded-xl bg-[#006c49] hover:bg-[#007f56] active:scale-[0.99] disabled:opacity-50 text-white font-semibold text-base px-8 py-3.5 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]"
              >
                {loading ? 'Sending code…' : 'Select and Proceed'}
              </button>
            </div>
          </section>
        )}

        {/* STEP 5: ENTER CODE FROM EMAIL */}
        {step === 'code' && (
          <section className="bg-[#131b2e] border border-white/10 rounded-2xl p-6 md:p-8">
            <div className="max-w-xl mx-auto space-y-6">
              <div>
                <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Step 5 of 5</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">Enter the code</h1>
                <p className="text-white/70 text-sm mt-1">
                  We emailed a 6-digit confirmation code to <strong className="text-white font-mono">{sentTo || 'your email'}</strong>.
                </p>
              </div>

              {/* Selection Privacy Chip */}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#0b1c30] border border-white/10 px-4 py-3.5">
                <div className="text-sm">
                  <span className="text-white/50 block text-xs">Casting ballot for:</span>
                  <span className="font-bold text-white text-base">
                    {revealCandidate ? selected?.name || '—' : '••••••••••••'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealCandidate((v) => !v)}
                  className="text-[#38bdf8] p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  title={revealCandidate ? 'Hide choice' : 'Show choice'}
                >
                  {revealCandidate ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-xs text-amber-200/90 leading-relaxed">
                ⚠️ <strong>Finality notice:</strong> Once confirmed, your vote is immutably recorded for your home constituency. It cannot be altered or undone.
              </div>

              <form onSubmit={castVote} className="space-y-6">
                <div>
                  <label htmlFor="otp-input" className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                    6-Digit Code
                  </label>
                  <input
                    id="otp-input"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-xl bg-[#0b1c30] border-2 border-white/15 focus:border-[#10b981] px-4 py-4 outline-none font-mono tracking-[0.3em] text-center text-3xl text-white shadow-inner transition-colors"
                  />
                </div>

                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" /> Recording Vote…
                    </span>
                  ) : (
                    'Confirm My Vote'
                  )}
                </button>

                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="w-full text-sm text-[#38bdf8] hover:text-[#7dd3fc] py-2 transition-colors cursor-pointer"
                >
                  Didn&apos;t get it? Send the code again
                </button>
              </form>
            </div>
          </section>
        )}

        {/* STEP 6: DONE — RECEIPT CODE */}
        {step === 'done' && (
          <section className="bg-[#131b2e] border border-white/10 rounded-2xl p-8 md:p-12 text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#10b981]/15 border-2 border-[#10b981] flex items-center justify-center mx-auto text-[#10b981]">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Ballot Cast Successfully</span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mt-1">Your vote is recorded</h1>
              <p className="text-white/70 text-sm mt-2 max-w-md mx-auto">
                Counted directly for <strong className="text-white">{slip?.constituencyName || slip?.seatName || 'your home constituency'}</strong>.
              </p>
            </div>

            {/* Cryptographic Receipt Box (Monospaced & Verified) */}
            {receiptCode && (
              <div className="rounded-2xl bg-[#0b1c30] border border-white/10 p-5 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Receipt Code</span>
                  <button
                    type="button"
                    onClick={copyReceipt}
                    className="inline-flex items-center gap-1.5 text-xs text-[#38bdf8] hover:text-[#7dd3fc] transition-colors"
                  >
                    {copiedCode ? <Check size={14} className="text-[#10b981]" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="font-mono text-xs break-all text-white/90 bg-white/5 p-3 rounded-lg border border-white/5">
                  {receiptCode}
                </p>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Anyone can check this receipt code at the public Verify portal to prove this ballot was included in the final count. Your candidate selection remains strictly secret.
                </p>
              </div>
            )}

            <div className="pt-4 space-y-3">
              <button type="button" onClick={resetForNextVoter} className={primaryBtn}>
                Next Voter
              </button>
              <p className="text-xs text-white/40" aria-live="polite">
                This booth resets automatically in <strong className="text-white/70">{resetIn}s</strong>.
              </p>
            </div>
          </section>
        )}

        {/* Global Error Banner */}
        {error && (
          <div
            className="mt-6 flex items-start gap-3 text-sm text-red-200 bg-red-950/40 border border-red-800/50 rounded-2xl p-4 shadow-md"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" aria-hidden="true" />
            <span className="flex-1">{error}</span>
          </div>
        )}
      </main>
    </div>
  );
}

