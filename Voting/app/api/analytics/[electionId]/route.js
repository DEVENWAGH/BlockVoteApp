/**
 * GET /api/analytics/[electionId]
 * Real-time analytics for a specific election.
 * Returns hourly distribution, candidate breakdown, activity feed, and stats.
 * 
 * This is the "Serverless Real-Time Analytics" cloud integration —
 * uses MongoDB aggregation pipeline instead of slow blockchain queries.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoteActivity from '@/lib/models/VoteActivity';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';
import Voter from '@/lib/models/Voter';
import BiometricHash from '@/lib/models/BiometricHash';

/** Ballots in the delayed window before any candidate share is published. */
const SHARE_MIN_VOTES = 50;
/** Place and hour cells smaller than this are omitted so one voter cannot be picked out. */
const SMALL_CELL = 5;

function publishBuckets(counts, min = SMALL_CELL) {
  const published = {};
  let hiddenGroups = 0;
  for (const [key, count] of Object.entries(counts || {})) {
    if (!key || key === 'Unknown') continue;
    if (count >= min) published[key] = count;
    else hiddenGroups += 1;
  }
  return { buckets: published, hiddenGroups };
}

function roundPercents(rows) {
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  if (!total) return [];
  const drafts = rows.map((row) => {
    const exact = (row.votes / total) * 100;
    return { ...row, percent: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let leftover = 100 - drafts.reduce((sum, row) => sum + row.percent, 0);
  drafts.sort((a, b) => b.remainder - a.remainder);
  for (const row of drafts) {
    if (leftover <= 0) break;
    row.percent += 1;
    leftover -= 1;
  }
  return drafts
    .map(({ name, party, percent }) => ({ name, party, percent }))
    .sort((a, b) => b.percent - a.percent);
}

function normalizeBucket(value, fallback = 'Unknown') {
  const text = String(value || '').trim();
  return text || fallback;
}

function countBuckets(items, mapper) {
  const counts = {};
  for (const item of items) {
    const key = normalizeBucket(mapper(item));
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const publicMode = searchParams.get('public') === '1';
    const requestedDelay = Number(searchParams.get('delay'));
    const delayMinutes = requestedDelay === 60 ? 60 : 10;
    const shareCutoff = new Date(Date.now() - delayMinutes * 60 * 1000);
    const { electionId } = await params;
    const eid = String(electionId);

    // 1. Hourly vote distribution (time-series data for chart)
    const hourlyDistribution = await VoteActivity.aggregate([
      { $match: { electionId: eid } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          count: 1,
        },
      },
    ]);

    // 2. Per-candidate vote breakdown (bar chart data)
    const candidateBreakdown = await VoteActivity.aggregate([
      { $match: { electionId: eid } },
      {
        $group: {
          _id: '$candidateId',
          votes: { $sum: 1 },
          firstVote: { $min: '$timestamp' },
          lastVote: { $max: '$timestamp' },
        },
      },
      { $sort: { votes: -1 } },
      {
        $project: {
          _id: 0,
          candidateId: '$_id',
          votes: 1,
          firstVote: 1,
          lastVote: 1,
        },
      },
    ]);

    // 3. Total stats
    const totalVotes = await VoteActivity.countDocuments({ electionId: eid });
    const votesLast1h = await VoteActivity.countDocuments({
      electionId: eid,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const votesLast24h = await VoteActivity.countDocuments({
      electionId: eid,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    // Candidate shares use only ballots older than the delay window, and only
    // once that window is large enough that one new ballot cannot be traced.
    const delayedBreakdown = await VoteActivity.aggregate([
      { $match: { electionId: eid, timestamp: { $lte: shareCutoff } } },
      { $group: { _id: '$candidateId', votes: { $sum: 1 } } },
    ]);
    const delayedTotal = delayedBreakdown.reduce((sum, row) => sum + row.votes, 0);
    let candidateShares = {
      visible: false,
      minimumBallots: SHARE_MIN_VOTES,
      delayMinutes,
      through: shareCutoff.toISOString(),
      shares: [],
    };
    if (delayedTotal >= SHARE_MIN_VOTES) {
      const candidates = await Candidate.find({ electionId: eid })
        .select('candidateId name party')
        .lean();
      const byId = new Map(candidates.map((c) => [Number(c.candidateId), c]));
      candidateShares = {
        visible: true,
        minimumBallots: SHARE_MIN_VOTES,
        delayMinutes,
        through: shareCutoff.toISOString(),
        shares: roundPercents(delayedBreakdown.map((row) => {
          const candidate = byId.get(Number(row._id));
          return {
            name: candidate?.name || 'Candidate',
            party: candidate?.party || '',
            votes: row.votes,
          };
        })),
      };
    }

    const publishedHourly = hourlyDistribution.filter((row) => {
      const hourStart = new Date(row.hour).getTime();
      return Number.isFinite(hourStart)
        && hourStart + 60 * 60 * 1000 <= shareCutoff.getTime()
        && row.count >= SMALL_CELL;
    });

    // 6. Election metadata
    const election = await Election.findOne({ electionId: eid }).lean();

    // 7. Votes per minute (velocity) — last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await VoteActivity.countDocuments({
      electionId: eid,
      timestamp: { $gte: tenMinAgo },
    });
    const votesPerMinute = (recentCount / 10).toFixed(2);

    // 8. Demographics (aggregated from Voter collection — NOT linked to individual votes)
    // PRIVACY: Demographics are computed from the voter ROSTER, not correlated
    // with individual vote records. This means we know "40% of registered voters
    // are female" but NOT "this specific vote was cast by a female voter."
    const registeredVoters = await Voter.find({ electionId: eid, status: 'registered' }).lean();
    const biometrics = await BiometricHash.find({
      nullifierHash: { $in: registeredVoters.map(v => v.nullifierHash).filter(Boolean) }
    }).lean();

    const bioMap = {};
    for (const b of biometrics) {
      bioMap[b.nullifierHash] = b;
    }

    const ageGroups = {
      '18-25': 0,
      '26-35': 0,
      '36-50': 0,
      '50+': 0,
      'Unknown': 0
    };

    const rosterGenders = {
      'Male': 0,
      'Female': 0,
      'Other': 0,
      'Unknown': 0
    };

    const rekognitionGenders = {
      'Male': 0,
      'Female': 0,
      'Unknown': 0
    };

    let genderMatches = 0;
    let genderMismatches = 0;
    let genderCompareUnknowns = 0;

    for (const voter of registeredVoters) {
      // Age groups
      if (voter.age) {
        const age = voter.age;
        if (age >= 18 && age <= 25) ageGroups['18-25']++;
        else if (age >= 26 && age <= 35) ageGroups['26-35']++;
        else if (age >= 36 && age <= 50) ageGroups['36-50']++;
        else if (age > 50) ageGroups['50+']++;
        else ageGroups['Unknown']++;
      } else {
        ageGroups['Unknown']++;
      }

      // Roster genders
      let rGender = 'Unknown';
      if (voter.gender) {
        const g = voter.gender.trim().toLowerCase();
        if (g === 'male' || g === 'm') { rGender = 'Male'; rosterGenders['Male']++; }
        else if (g === 'female' || g === 'f') { rGender = 'Female'; rosterGenders['Female']++; }
        else if (g) { rGender = 'Other'; rosterGenders['Other']++; }
        else { rosterGenders['Unknown']++; }
      } else {
        rosterGenders['Unknown']++;
      }

      // Rekognition genders
      const bio = bioMap[voter.nullifierHash];
      let awsGender = 'Unknown';
      if (bio?.faceAttributes?.gender) {
        const g = bio.faceAttributes.gender.trim().toLowerCase();
        if (g === 'male') { awsGender = 'Male'; rekognitionGenders['Male']++; }
        else if (g === 'female') { awsGender = 'Female'; rekognitionGenders['Female']++; }
        else { rekognitionGenders['Unknown']++; }
      } else {
        rekognitionGenders['Unknown']++;
      }

      // Gender Match checks
      if (rGender !== 'Unknown' && awsGender !== 'Unknown') {
        if (rGender.toLowerCase() === awsGender.toLowerCase()) {
          genderMatches++;
        } else {
          genderMismatches++;
        }
      } else {
        genderCompareUnknowns++;
      }
    }

    // Re-vote stats (V3 feature)
    const revoteCount = await VoteActivity.countDocuments({ electionId: eid, isRevote: true });
    const regionRaw = countBuckets(registeredVoters, (v) => v.region || v.state);
    const stateRaw = countBuckets(registeredVoters, (v) => v.state || v.region);
    const cityRaw = countBuckets(registeredVoters, (v) => v.city);
    const villageRaw = countBuckets(registeredVoters, (v) => v.village);
    const localityRaw = countBuckets(registeredVoters, (v) => v.localityType);
    const cityTierRaw = countBuckets(registeredVoters, (v) => v.cityTier);
    const regionPublished = publishBuckets(regionRaw);
    const statePublished = publishBuckets(stateRaw);
    const cityPublished = publishBuckets(cityRaw);
    const villagePublished = publishBuckets(villageRaw);
    const localityPublished = publishBuckets(localityRaw);
    const cityTierPublished = publishBuckets(cityTierRaw);
    const agePublished = publishBuckets(ageGroups);
    const genderPublished = publishBuckets(rosterGenders);

    const locationShared = registeredVoters.filter((voter) => (
      voter.state || voter.city || voter.village || voter.region
    )).length;

    const publishedPeak = publishedHourly.length > 0
      ? publishedHourly.reduce((max, row) => (row.count > max.count ? row : max), publishedHourly[0])
      : null;

    const countsVisible = totalVotes >= SHARE_MIN_VOTES;
    const electionMeta = election ? {
      title: election.title,
      description: election.description,
      phase: election.phase,
      startTime: election.startTime,
      endTime: election.endTime,
    } : null;

    const publicStats = {
      totalVotes,
      countsVisible,
      votesLast1h,
      votesLast24h,
      votesPerMinute: Number(votesPerMinute),
      peakHour: publishedPeak ? { hour: publishedPeak.hour, votes: publishedPeak.count } : null,
      registeredVoterCount: registeredVoters.length,
      locationShared,
      turnoutRate: registeredVoters.length > 0
        ? Number(((totalVotes / registeredVoters.length) * 100).toFixed(1))
        : 0,
    };

    const publicData = {
      electionId: eid,
      election: electionMeta,
      stats: publicStats,
      hourlyDistribution: publishedHourly,
      candidateShares,
      demographics: {
        ageGroups: agePublished.buckets,
        genderSplit: genderPublished.buckets,
        localityTypeBuckets: localityPublished.buckets,
        cityTierBuckets: cityTierPublished.buckets,
        regionBuckets: regionPublished.buckets,
        stateBuckets: statePublished.buckets,
        cityBuckets: cityPublished.buckets,
        villageBuckets: villagePublished.buckets,
        hiddenPlaceGroups: regionPublished.hiddenGroups + cityPublished.hiddenGroups + villagePublished.hiddenGroups,
      },
    };

    if (publicMode) {
      return NextResponse.json({
        success: true,
        data: publicData,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...publicData,
        stats: {
          ...publicStats,
          candidateCount: candidateBreakdown.length,
          revoteCount,
        },
        demographics: {
          registeredVoterCount: registeredVoters.length,
          ageGroups: agePublished.buckets,
          genderSplit: genderPublished.buckets,
          rosterGenders: genderPublished.buckets,
          rekognitionGenders,
          genderMatchStats: {
            matches: genderMatches,
            mismatches: genderMismatches,
            unknowns: genderCompareUnknowns,
            matchRate: (genderMatches + genderMismatches) > 0
              ? Number(((genderMatches / (genderMatches + genderMismatches)) * 100).toFixed(1))
              : 100
          },
          localityTypeBuckets: localityPublished.buckets,
          cityTierBuckets: cityTierPublished.buckets,
          regionBuckets: regionPublished.buckets,
          stateBuckets: statePublished.buckets,
          cityBuckets: cityPublished.buckets,
          villageBuckets: villagePublished.buckets,
          hiddenPlaceGroups: regionPublished.hiddenGroups + cityPublished.hiddenGroups + villagePublished.hiddenGroups,
        },
      },
    });
  } catch (err) {
    console.error('[analytics]', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
