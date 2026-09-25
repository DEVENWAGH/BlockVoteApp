'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, Smartphone, Vote } from 'lucide-react';
import { isAndroidUserAgent, isIosUserAgent } from '@/lib/clientDevice';
import { getAndroidIntentUrl, getVoteDeepLink } from '@/lib/appLinks';

/**
 * On Android browsers, try to open the installed BlockVote app.
 * If it is missing, show install / open-app fallback — not surrounding-monitor web voting.
 */
export default function MobileAppGate({ electionId = '', stayHref, children }) {
  const [ready, setReady] = useState(false);
  const [android, setAndroid] = useState(false);
  const [ios, setIos] = useState(false);
  const [stayOnWeb, setStayOnWeb] = useState(false);
  const [copied, setCopied] = useState(false);

  const deepLink = useMemo(() => getVoteDeepLink(electionId), [electionId]);
  const intentUrl = useMemo(() => getAndroidIntentUrl(electionId), [electionId]);
  const stayQuerySep =
    typeof window !== 'undefined' && window.location.search
      ? '&'
      : '?';
  const browserStayHref =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}${stayQuerySep}web=1`
      : '/?web=1';
  const portalStayHref = stayHref || browserStayHref;
  const onLocalhost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('web') === '1') {
      setStayOnWeb(true);
      setReady(true);
      return;
    }
    const ua = navigator.userAgent || '';
    const isAndroid = isAndroidUserAgent(ua);
    const isIos = isIosUserAgent(ua);
    setAndroid(isAndroid);
    setIos(isIos);
    setReady(true);

    if (!isAndroid) return;

    const t = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 250);
    const intentTimer = window.setTimeout(() => {
      window.location.href = intentUrl;
    }, 900);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(intentTimer);
    };
  }, [deepLink, intentUrl]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] text-white flex items-center justify-center">
        <p className="text-sm text-white/60">Opening BlockVote…</p>
      </div>
    );
  }

  if (stayOnWeb || (!android && !ios)) {
    return children;
  }

  return (
    <main className="min-h-screen bg-[#0A0F1D] text-white flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#0078D4] flex items-center justify-center">
          <Vote size={26} aria-hidden="true" />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.22em] text-[#2899F5] uppercase">
          BlockVote
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-pretty">
          {android ? 'Open the Android app to vote' : 'Use the Android app on your phone'}
        </h1>
        <p className="text-white/65 leading-relaxed text-pretty">
          {android
            ? 'Phones can watch the room with motion sensors. We tried to open BlockVote — if nothing happened, the app may not be installed.'
            : 'BlockVote voting is built for Android. Install the app on an Android phone, or use a computer for the web beta.'}
        </p>

        {android && (
          <a
            href={intentUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-6 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
          >
            <Smartphone size={18} aria-hidden="true" />
            Open in BlockVote app
          </a>
        )}

        <p className="text-sm text-white/45 leading-relaxed">
          No store listing yet? Ask your election admin for the BlockVote APK, then return to this link.
        </p>

        {onLocalhost && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100">
            This is a local-dev URL. On a physical phone, `localhost` points to the phone itself, not your computer. Use your PC&apos;s LAN IP or open the app directly with the button below.
          </div>
        )}

        <div className="grid gap-3">
          <a
            href={deepLink}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 hover:border-white/35 text-white font-semibold px-6 py-3.5 transition-colors"
          >
            <ExternalLink size={18} aria-hidden="true" />
            Open direct app link
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(deepLink);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {}
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 hover:border-white/35 text-white/80 hover:text-white font-semibold px-6 py-3.5 transition-colors"
          >
            <Copy size={18} aria-hidden="true" />
            {copied ? 'App link copied' : 'Copy app link'}
          </button>
        </div>

        {android && (
          <p className="text-xs text-white/40">
            Need a laptop ballot instead?{' '}
            <Link href={portalStayHref} className="text-[#2899F5] hover:underline">
              Continue on web beta
            </Link>
          </p>
        )}

        {ios && (
          <Link
            href={portalStayHref}
            className="inline-flex w-full items-center justify-center rounded-full border border-white/15 hover:border-white/35 text-white font-semibold px-6 py-3.5 transition-colors"
          >
            Continue on web beta
          </Link>
        )}
      </div>
    </main>
  );
}
