import connectDB from '@/lib/db';
import Constituency from '@/lib/models/Constituency';
import Voter from '@/lib/models/Voter';
import Election from '@/lib/models/Election';
import Booth from '@/lib/models/Booth';
import StationSetup from '@/components/voter-portal/StationSetup';
import { phaseLabel } from '@/lib/voterMessages';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { stationName } = await params;
  const decoded = decodeURIComponent(stationName || '').replace(/-/g, ' ');
  return {
    title: `${decoded} — Polling Station Desk | BlockVote`,
    description: `Supervised polling booth and area voter management for ${decoded}.`,
  };
}

export default async function DynamicStationPage({ params }) {
  const { stationName: rawParam } = await params;
  const decoded = decodeURIComponent(rawParam || '').trim();

  // Extract ward number if present (e.g. panvel-w7, ward-7, w7, ward7)
  const wardMatch = decoded.match(/(?:ward|w)[-_\s]?([0-9]+)/i);
  const wardNumber = wardMatch ? wardMatch[1] : null;

  // Extract core tokens without the ward indicator (e.g. "panvel-w7" -> "panvel")
  const cleanTokens = decoded
    .replace(/(?:ward|w)[-_\s]?([0-9]+)/ig, ' ')
    .replace(/[-_]+/g, ' ')
    .trim();
  const cleanSpaced = decoded.replace(/[-_]+/g, ' ').trim();

  await connectDB();

  const regexLiteral = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. Search for matching Constituency
  const cQuery = [];
  if (decoded) {
    cQuery.push({ code: new RegExp(`^${regexLiteral(decoded)}$`, 'i') });
  }
  if (cleanTokens) {
    cQuery.push({ code: new RegExp(`^${regexLiteral(cleanTokens)}$`, 'i') });
    cQuery.push({ name: new RegExp(`^${regexLiteral(cleanTokens)}$`, 'i') });
    cQuery.push({ name: new RegExp(regexLiteral(cleanTokens), 'i') });
  }
  if (cleanSpaced) {
    cQuery.push({ code: new RegExp(`^${regexLiteral(cleanSpaced)}$`, 'i') });
    cQuery.push({ name: new RegExp(`^${regexLiteral(cleanSpaced)}$`, 'i') });
    cQuery.push({ name: new RegExp(regexLiteral(cleanSpaced), 'i') });
  }

  const constituency = cQuery.length ? await Constituency.findOne({ $or: cQuery }).lean() : null;

  // 2. Search for matching Voter to identify home polling station and area
  const voterQuery = [];
  if (wardNumber) {
    if (constituency) {
      voterQuery.push({
        ward: String(wardNumber),
        assemblyConstituency: constituency.code.toUpperCase(),
      });
    }
    if (cleanTokens) {
      voterQuery.push({
        ward: String(wardNumber),
        city: new RegExp(`^${regexLiteral(cleanTokens)}$`, 'i'),
      });
      voterQuery.push({
        ward: String(wardNumber),
        district: new RegExp(`^${regexLiteral(cleanTokens)}$`, 'i'),
      });
    }
    voterQuery.push({ ward: String(wardNumber) });
  }

  if (constituency) {
    voterQuery.push(
      { assemblyConstituency: constituency.code.toUpperCase() },
      { parliamentaryConstituency: constituency.code.toUpperCase() }
    );
  }

  if (cleanTokens) {
    voterQuery.push(
      { homePollingStation: new RegExp(regexLiteral(cleanTokens), 'i') },
      { city: new RegExp(`^${regexLiteral(cleanTokens)}$`, 'i') }
    );
  }

  if (cleanSpaced) {
    voterQuery.push(
      { homePollingStation: new RegExp(regexLiteral(cleanSpaced), 'i') },
      { city: new RegExp(`^${regexLiteral(cleanSpaced)}$`, 'i') },
      { district: new RegExp(`^${regexLiteral(cleanSpaced)}$`, 'i') }
    );
  }

  const sampleVoter = voterQuery.length ? await Voter.findOne({ $or: voterQuery }).lean() : null;

  // 3. Find active election
  const election = await Election.findOne({ phase: { $ne: 2 } }).sort({ createdAt: -1 }).lean()
    || await Election.findOne({}).sort({ createdAt: -1 }).lean();

  // 4. Derive station details
  const finalStationName =
    sampleVoter?.homePollingStation
      ? (wardNumber
          ? `${sampleVoter.homePollingStation} (Ward ${wardNumber}, ${sampleVoter.city || constituency?.name || 'Area'})`
          : sampleVoter.homePollingStation)
      : (constituency ? `${constituency.name} Central Polling Station` : cleanSpaced);

  const finalDistrict =
    sampleVoter?.district || constituency?.district || 'Raigad';

  const finalState =
    sampleVoter?.state || constituency?.state || 'Maharashtra';

  const finalCity =
    sampleVoter?.city || constituency?.city || (cleanTokens ? cleanTokens.charAt(0).toUpperCase() + cleanTokens.slice(1) : '');

  const finalWard = wardNumber || sampleVoter?.ward || '';

  const finalBoothCode =
    constituency
      ? `BOOTH-${constituency.code}${finalWard ? `-W${finalWard}` : ''}`
      : `BOOTH-${decoded.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;

  // 5. Ensure booth record exists in MongoDB
  if (election) {
    try {
      await Booth.findOneAndUpdate(
        { electionId: election.electionId, nameKey: finalStationName.toLowerCase() },
        {
          $set: {
            name: finalStationName,
            code: finalBoothCode,
            state: finalState,
            district: finalDistrict,
            lastActivatedAt: new Date(),
          },
          $inc: { activations: 1 },
        },
        { upsert: true }
      );
    } catch (e) {
      console.warn('Booth upsert warning:', e.message);
    }
  }

  const stationData = {
    stationName: finalStationName,
    rawStationName: sampleVoter?.homePollingStation || finalStationName,
    ward: finalWard,
    city: finalCity,
    assemblyConstituency: constituency?.code || sampleVoter?.assemblyConstituency || '',
    electionId: election?.electionId || '',
    electionTitle: election?.title || 'General Election',
    electionPhase: election?.phase ?? 0,
    electionStatus: phaseLabel(election?.phase),
    guardianApproved: Boolean(election?.guardianApproved),
    state: finalState,
    district: finalDistrict,
    boothCode: finalBoothCode,
  };

  return (
    <StationSetup
      signedIn={true}
      adminName="Guardian Authority"
      station={stationData}
    />
  );
}
