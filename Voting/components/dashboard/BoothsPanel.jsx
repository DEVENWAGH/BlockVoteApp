'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Landmark } from 'lucide-react';
import { Spinner, SectionTitle, Pill, secondaryBtn, getJson } from './ui';

/**
 * Booths started for this election and how many ballots were cast at each.
 * A booth is where people vote, not what they vote for.
 */
export default function BoothsPanel({ electionId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['booths', electionId],
    queryFn: () => getJson(`/api/booths?electionId=${electionId}`),
    enabled: !!electionId,
    refetchInterval: 30_000,
  });
  const booths = data?.booths || [];

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={Landmark}
        title="Polling booths"
        help="Start a booth on any computer from the station page. Voters from anywhere can vote at any booth and still see their home ballot."
        right={
          <a href="/station" target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
            <ExternalLink size={12} /> Start a booth
          </a>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : booths.length === 0 ? (
        <div className="text-center py-8 text-body text-sm border border-dashed border-hairline rounded-xl bg-canvas">
          No booth has been started for this election yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                <th className="text-left px-4 py-3 font-semibold">Booth</th>
                <th className="text-left px-4 py-3 font-semibold">Place</th>
                <th className="text-right px-4 py-3 font-semibold">Ballots cast here</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Last started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {booths.map((b) => (
                <tr key={b._id}>
                  <td className="px-4 py-2.5 text-ink font-medium">
                    {b.name} {b.code && <span className="text-muted font-mono text-xs">{b.code}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-body text-xs">{[b.district, b.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-2.5 text-right"><Pill tone={b.ballots ? 'info' : 'neutral'}>{b.ballots}</Pill></td>
                  <td className="px-4 py-2.5 text-muted text-xs hidden md:table-cell">{b.lastActivatedAt ? new Date(b.lastActivatedAt).toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
