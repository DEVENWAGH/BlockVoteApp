import StationSetup from '@/components/voter-portal/StationSetup';
import { getStationSession } from '@/lib/stationSession';

export const metadata = {
  title: 'Polling Station Officer Desk — BlockVote',
  description: 'Manage polling booth and verify registered voters of this area.',
};

export const dynamic = 'force-dynamic';

export default async function StationPage() {
  const station = await getStationSession();

  return (
    <StationSetup
      signedIn={true}
      adminName="Guardian Authority"
      station={
        station
          ? {
              stationName: station.stationName,
              electionId: station.electionId,
              state: station.state || '',
              district: station.district || '',
              boothCode: station.boothCode || '',
            }
          : null
      }
    />
  );
}
