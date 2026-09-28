'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, Calendar, Loader2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import ElectionAnalyticsPanel from '@/components/ElectionAnalyticsPanel';

export default function AnalyticsDashboardPage() {
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/elections')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data && d.data.length > 0) {
          setElections(d.data);
          const active = d.data.find((e) => e.phase === 1) || d.data[0];
          setSelectedElectionId(active.electionId);
        } else {
          setError('No elections found.');
        }
      })
      .catch(() => {
        setError('Failed to load elections.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <BarChart3 className="text-white" size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-ink text-base leading-tight">Public Analytics</h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">Updates every 10 minutes</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <Link href="/elections" className="text-xs text-primary hover:text-primary-active font-semibold transition">
            Elections
          </Link>
          <div className="flex items-center gap-2 bg-surface-soft border border-hairline rounded-full px-3 py-1.5 text-xs text-body">
            <Calendar size={14} className="text-primary shrink-0" />
            <select
              value={selectedElectionId || ''}
              onChange={(e) => setSelectedElectionId(e.target.value)}
              aria-label="Election"
              className="bg-transparent border-none outline-none text-ink font-semibold max-w-[220px] cursor-pointer"
            >
              {elections.map((el) => (
                <option key={el.electionId} value={el.electionId}>
                  {el.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      <main className="px-6 md:px-16 py-12 max-w-6xl mx-auto w-full">
        {error ? (
          <p className="text-sm text-semantic-down">{error}</p>
        ) : (
          <ElectionAnalyticsPanel electionId={selectedElectionId} />
        )}
      </main>
    </div>
  );
}
