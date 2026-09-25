'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/org-auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong');
      }
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
              {sent ? 'Check your email' : 'Reset your password'}
            </h1>
            <p className="text-body text-sm mt-1">
              {sent
                ? 'If an account exists with that email, we sent a reset link.'
                : 'Enter your email and we\'ll send you a reset link'}
            </p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <p className="text-body text-sm text-center">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                try again
              </button>.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-start gap-2.5 bg-canvas border border-semantic-down rounded-xl p-3 mb-5 text-semantic-down text-sm">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@email.com"
                    required
                    className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all disabled:opacity-50 text-sm cursor-pointer shadow-sm"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="text-center mt-6 text-xs">
          <Link href="/login" className="text-muted hover:text-ink transition inline-flex items-center gap-1">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
