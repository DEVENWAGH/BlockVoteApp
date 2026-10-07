'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

function TwinRequestContent() {
  const searchParams = useSearchParams();
  const [electionId, setElectionId] = useState(searchParams.get('electionId') || '');
  const [voterId, setVoterId] = useState(searchParams.get('voterId') || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const cleanId = voterId.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const lookupRes = await fetch(
        `/api/voters/lookup?voterId=${encodeURIComponent(cleanId)}&electionId=${encodeURIComponent(electionId.trim())}`
      );
      const lookup = await lookupRes.json();
      if (!lookupRes.ok || !lookup.nullifierHash) {
        throw new Error(lookup.error || 'This voter ID is not on the list. Check the ID or ask the booth officer.');
      }

      const res = await fetch('/api/biometric/twin-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifierHash: lookup.nullifierHash,
          electionId: electionId.trim(),
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send the request. Please try again.');

      setSuccess(data.message || 'Your request was sent. Staff will review it.');
      setStatus(data.status || 'pending');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-hairline px-4 py-4 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <Shield className="text-primary" size={20} />
          <span className="font-semibold text-sm">BlockVote</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Users size={18} />
            <h1 className="text-xl font-semibold">Look-alike check</h1>
          </div>
          <p className="text-body text-sm">
            If the face check said your face matches someone else (for example a twin), send this request.
            Election staff review it and can approve you to continue.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-lg p-3 text-sm">
            <CheckCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p>{success}</p>
              {status && (
                <p className="text-xs mt-1 opacity-80">Status: {status}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-canvas border border-hairline rounded-xl p-5 space-y-4 shadow-sm">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-body uppercase tracking-wide">Election ID</span>
            <input
              type="text"
              value={electionId}
              onChange={(e) => setElectionId(e.target.value)}
              required
              className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="From your invite email"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-body uppercase tracking-wide">Voter ID</span>
            <input
              type="text"
              value={voterId}
              onChange={(e) => setVoterId(e.target.value.toUpperCase())}
              required
              autoCapitalize="characters"
              className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="As printed on your voter card, e.g. ABC1234567"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-body uppercase tracking-wide">Note for staff (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-surface-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="e.g. I have an identical twin who is also on the roll"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-active disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-full transition flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send request'}
          </button>
        </form>

        <p className="text-muted text-xs text-center">
          Staff see requests on their dashboard under &quot;Face check&quot;. Once approved, try the face check again.
        </p>
      </main>
    </div>
  );
}

export default function TwinRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    }>
      <TwinRequestContent />
    </Suspense>
  );
}
