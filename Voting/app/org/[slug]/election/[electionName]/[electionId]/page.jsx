import { redirect } from 'next/navigation';
import MobileAppGate from '@/components/voter-portal/MobileAppGate';
import StationRequired from '@/components/voter-portal/StationRequired';
import { getStationSession } from '@/lib/stationSession';
import { describeVotingHours } from '@/lib/votingWindow';

export const metadata = {
  title: 'Vote — BlockVote',
  description: 'Cast a ballot in the BlockVote app or at your polling station.',
};

export const dynamic = 'force-dynamic';

export default async function OrgElectionPortalPage({ params }) {
  const { slug, electionName: rawElectionName, electionId: rawElectionId } = await params;
  const orgName = decodeURIComponent(slug || '');
  const electionName = decodeURIComponent(rawElectionName || '');
  const electionId = decodeURIComponent(rawElectionId || '');

  if (!orgName || !electionName || !electionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-body text-sm">Invalid election link.</p>
      </div>
    );
  }

  const station = await getStationSession();
  if (station?.electionId === electionId) {
    redirect('/station/vote');
  }

  return (
    <MobileAppGate electionId={electionId}>
      <StationRequired
        electionId={electionId}
        electionTitle={electionName}
        hours={describeVotingHours()}
      />
    </MobileAppGate>
  );
}
