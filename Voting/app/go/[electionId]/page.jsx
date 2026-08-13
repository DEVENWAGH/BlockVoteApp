/**
 * HTTPS landing page for voter invite links.
 * Opens the Android app via deep link; falls back to install instructions.
 */
'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function GoVotePage() {
  const params = useParams();
  const electionId = decodeURIComponent(params?.electionId || '');

  const deepLink = useMemo(
    () => (electionId ? `blockvote://vote/${electionId}` : ''),
    [electionId],
  );

  useEffect(() => {
    if (!deepLink) return;
    const t = setTimeout(() => {
      window.location.href = deepLink;
    }, 400);
    return () => clearTimeout(t);
  }, [deepLink]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'radial-gradient(ellipse at top, #0c4a6e 0%, #020617 55%)',
        color: '#e2e8f0',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <p style={{ letterSpacing: '0.2em', fontSize: 12, color: '#7dd3fc', marginBottom: 12 }}>
          BLOCK VOTE
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px' }}>
          Open the mobile app to vote
        </h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: 28 }}>
          Voting is only available in the Block Vote Android app. We tried to open it
          automatically — if nothing happened, tap the button below.
        </p>
        <a
          href={deepLink}
          style={{
            display: 'inline-block',
            background: '#0ea5e9',
            color: '#fff',
            textDecoration: 'none',
            padding: '14px 22px',
            borderRadius: 12,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Open Block Vote app
        </a>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 20 }}>
          Admin site only —{' '}
          <Link href="/login" style={{ color: '#7dd3fc' }}>
            sign in to manage elections
          </Link>
        </p>
      </div>
    </main>
  );
}
