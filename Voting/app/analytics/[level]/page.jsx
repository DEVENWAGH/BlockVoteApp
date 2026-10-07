import Link from 'next/link';
import { BarChart3, Landmark, Building2, Building, Trees } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LevelAnalyticsView from '@/components/LevelAnalyticsView';

export const dynamic = 'force-dynamic';

const LEVEL_NAMES = {
  assembly: 'Assembly (MLA) Analytics',
  loksabha: 'Lok Sabha (MP) Analytics',
  municipal: 'Municipal Ward Analytics',
  panchayat: 'Panchayat Ward Analytics',
};

export async function generateMetadata({ params }) {
  const { level } = await params;
  const key = String(level || '').toLowerCase();
  const title = LEVEL_NAMES[key] || 'Tier Analytics';
  return {
    title: `${title} | BlockVote`,
    description: `Real-time cryptographic turnout and seat performance for ${title}.`,
  };
}

export default async function LevelAnalyticsPage({ params }) {
  const { level } = await params;
  const levelKey = String(level || '').toLowerCase();

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans" style={{ colorScheme: 'dark' }}>
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/analytics" className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <BarChart3 className="text-white" size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-ink text-base leading-tight truncate">
              {LEVEL_NAMES[levelKey] || 'Tier Analytics'}
            </h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">
              Real-Time Public Ledger Analytics
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <Link href="/analytics" className="text-xs text-body hover:text-ink font-semibold transition">
            Overview
          </Link>
          <Link href="/elections" className="text-xs text-body hover:text-ink font-semibold transition">
            Elections
          </Link>
          <Link href="/station" className="text-xs text-primary hover:text-primary-active font-semibold transition">
            Station Desk
          </Link>
        </div>
      </nav>

      <main className="px-6 md:px-16 py-10 max-w-6xl mx-auto w-full">
        <LevelAnalyticsView currentLevel={levelKey} />
      </main>
    </div>
  );
}
