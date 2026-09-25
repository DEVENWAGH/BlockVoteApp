import { Clock, Landmark, Smartphone } from 'lucide-react';
import { getVoteDeepLink } from '@/lib/appLinks';
import BrandLogo from '@/components/BrandLogo';

/**
 * Shown when a voter opens a web ballot link on a computer that is not an
 * activated polling station. Remote voting happens in the Android app.
 */
export default function StationRequired({ electionId = '', electionTitle = '', hours = '' }) {
  return (
    <main className="min-h-screen bg-[#0A0F1D] text-white flex items-center justify-center px-6 py-12" style={{ colorScheme: 'dark' }}>
      <div className="max-w-lg w-full space-y-8">
        <div className="space-y-4 text-center">
          <BrandLogo size={56} className="mx-auto" />
          {electionTitle && (
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#2899F5] uppercase">
              {electionTitle}
            </p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-pretty">
            Web ballots open only at polling stations
          </h1>
          {hours && (
            <p className="inline-flex items-center gap-1.5 text-sm text-white/60">
              <Clock size={14} aria-hidden="true" />
              Voting hours: {hours}
            </p>
          )}
        </div>

        <ul className="space-y-3">
          <li className="rounded-2xl border border-white/10 bg-[#1A1F2C] px-5 py-4 flex gap-4">
            <Smartphone className="text-[#2899F5] shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Vote from your phone</p>
              <p className="text-sm text-white/65 leading-relaxed">
                The BlockVote Android app scans your surroundings to keep the vote private. You can change
                your app vote once if you change your mind — the latest one counts.
              </p>
            </div>
          </li>
          <li className="rounded-2xl border border-white/10 bg-[#1A1F2C] px-5 py-4 flex gap-4">
            <Landmark className="text-[#2899F5] shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Or vote in person</p>
              <p className="text-sm text-white/65 leading-relaxed">
                At your polling station an officer opens this ballot on an official computer. A station vote
                is final and replaces any app vote — use it if you were pressured to vote a certain way.
              </p>
            </div>
          </li>
        </ul>

        <a
          href={getVoteDeepLink(electionId)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0078D4] hover:bg-[#2899F5] text-white font-semibold px-6 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2899F5]"
        >
          <Smartphone size={18} aria-hidden="true" />
          Open in BlockVote app
        </a>
      </div>
    </main>
  );
}
