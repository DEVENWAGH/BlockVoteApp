'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [done, setDone]               = useState(false);
  const [error, setError]             = useState('');

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-body text-sm">Invalid or missing reset link.</p>
        <Link href="/forgot-password" className="text-primary hover:underline font-semibold text-sm">
          Request a new one
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/org-auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-display text-ink">Password updated</h2>
          <p className="text-body text-sm">You can now sign in with your new password.</p>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all text-sm cursor-pointer shadow-sm"
        >
          Go to sign in
        </button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-start gap-2.5 bg-canvas border border-semantic-down rounded-xl p-3 mb-5 text-semantic-down text-sm">
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">
            New password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-11 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition cursor-pointer"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">
            Confirm password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
              minLength={8}
              className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all disabled:opacity-50 text-sm cursor-pointer shadow-sm"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Resetting…</> : 'Reset password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface-soft flex items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="w-full max-w-[440px] bg-canvas border border-hairline rounded-xl p-8 md:p-10 shadow-sm"
      >
        <div className="flex flex-col items-center mb-8 space-y-4">
          <BrandLogo size={40} />
          <div className="text-center">
            <h1 className="text-2xl font-display font-normal text-ink tracking-tight">
              Set new password
            </h1>
            <p className="text-body text-sm mt-1">Choose a strong password for your account</p>
          </div>
        </div>

        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-muted" /></div>}>
          <ResetForm />
        </Suspense>

        <p className="text-center mt-6 text-xs">
          <Link href="/login" className="text-muted hover:text-ink transition">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
