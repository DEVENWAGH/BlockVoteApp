import { redirect } from 'next/navigation';
import VoterWebPortal from '@/components/voter-portal/VoterWebPortal';
import { getStationSession } from '@/lib/stationSession';

export const metadata = {
  title: 'Polling station ballot — BlockVote',
  description: 'Supervised in-person ballot.',
};

export const dynamic = 'force-dynamic';

export default async function StationVotePage() {
  const station = await getStationSession();
  if (!station) redirect('/station');

  return (
    <VoterWebPortal
      station={{ stationName: station.stationName, electionId: station.electionId }}
    />
  );
}
