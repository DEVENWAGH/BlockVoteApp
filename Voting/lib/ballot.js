/**
 * lib/ballot.js
 * Shape candidates for voters: symbol first, live party symbol, no jargon.
 */
import Party from './models/Party.js';
import { resolveAssetUrl } from './urlUtils.js';

export function serializeParty(p, origin) {
  return {
    _id: p._id,
    code: p.code,
    name: p.name,
    symbol: resolveAssetUrl(p.symbol, origin),
    manifesto: p.manifesto || '',
    allowMultiplePerSeat: p.allowMultiplePerSeat === true,
    createdAt: p.createdAt,
  };
}

/**
 * Serialize Mongo Candidate docs. Party symbols are read live from the Party
 * record so a corrected symbol shows everywhere without re-adding candidates.
 */
export async function serializeCandidates(docs, origin) {
  const codes = [...new Set(docs.map((d) => d.partyCode).filter(Boolean))];
  const parties = codes.length ? await Party.find({ code: { $in: codes } }).lean() : [];
  const partyByCode = new Map(parties.map((p) => [p.code, p]));

  return docs.map((d) => {
    const party = partyByCode.get(d.partyCode);
    const symbol = party?.symbol || d.symbol || '';
    return {
      id: Number(d.candidateId),
      candidateId: Number(d.candidateId),
      name: d.name,
      party: party?.name || d.party || '',
      partyCode: d.partyCode || '',
      symbol: resolveAssetUrl(symbol, origin),
      photoUrl: resolveAssetUrl(d.photoUrl || '', origin),
      manifesto: d.manifesto || '',
      constituencyCode: d.constituencyCode || '',
      constituencyName: d.constituencyName || '',
      voteCount: Number(d.voteCount || 0),
    };
  });
}
