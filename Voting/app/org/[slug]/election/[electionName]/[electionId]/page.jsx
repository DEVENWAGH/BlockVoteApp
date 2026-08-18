import MobileAppGate from '@/components/voter-portal/MobileAppGate';
import VoterWebPortal from '@/components/voter-portal/VoterWebPortal';

export const metadata = {
  title: 'Vote — BlockVote web beta',
  description: 'Cast a ballot in the BlockVote web beta.',
};

export default function OrgElectionPortalPage({ params }) {
  const orgName = decodeURIComponent(params?.slug || '');
  const electionName = decodeURIComponent(params?.electionName || '');
  const electionId = decodeURIComponent(params?.electionId || '');

  if (!orgName || !electionName || !electionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-body text-sm">Invalid election link.</p>
      </div>
    );
  }

  const canonicalBase = `/org/${encodeURIComponent(orgName)}/election/${encodeURIComponent(
    electionName,
  )}/${encodeURIComponent(electionId)}`;

  return (
    <MobileAppGate electionId={electionId} stayHref={`${canonicalBase}?web=1`}>
      <VoterWebPortal initialElectionId={electionId} />
    </MobileAppGate>
  );
}
