/**
 * Legacy /vote/[slug] — voting moved to mobile app only.
 * Redirects users to install / open the app.
 */
'use client';

import Link from 'next/link';

export default function LegacyVotePage() {
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
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <p style={{ letterSpacing: '0.2em', fontSize: 12, color: '#7dd3fc', marginBottom: 12 }}>
          BLOCK VOTE
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px' }}>
          Voting moved to the mobile app
        </h1>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
          Web ballots are disabled. Use the invite link from your email
          (<code style={{ color: '#7dd3fc' }}>/go/&lt;electionId&gt;</code>) or open
          <code style={{ color: '#7dd3fc' }}> blockvote://vote/&lt;electionId&gt;</code> on your phone.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            background: '#0ea5e9',
            color: '#fff',
            textDecoration: 'none',
            padding: '14px 22px',
            borderRadius: 12,
            fontWeight: 700,
          }}
        >
          Admin login
        </Link>
      </div>
    </main>
  );
}
