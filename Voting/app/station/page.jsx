import { auth } from '@/auth';
import StationSetup from '@/components/voter-portal/StationSetup';
import { getStationSession } from '@/lib/stationSession';

export const metadata = {
  title: 'Polling station setup — BlockVote',
  description: 'Activate this computer as a BlockVote polling station.',
};

export const dynamic = 'force-dynamic';

export default async function StationPage() {
  const session = await auth();
  const station = await getStationSession();

  return (
    <StationSetup
      signedIn={Boolean(session?.user?.adminId)}
      adminName={session?.user?.name || ''}
      station={
        station
          ? { stationName: station.stationName, electionId: station.electionId }
          : null
      }
    />
  );
}
