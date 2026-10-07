import mongoose from 'mongoose';

/**
 * Candidate — a person, standing for one party, in one seat.
 *
 * The party symbol is NOT uploaded per candidate: `symbol` is a copy of the
 * party's symbol taken when the candidate was added (the chain needs a
 * string), and ballots read the live symbol from the Party record.
 *
 * Rule: one candidate per party per constituency in an election, unless the
 * party allows many (independents).
 */
const CandidateSchema = new mongoose.Schema(
  {
    electionId:  { type: String, required: true, index: true },
    candidateId: { type: Number, required: true },
    name:        { type: String, required: true },
    party:       { type: String, required: true },
    partyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    partyCode:   { type: String, default: '', uppercase: true, trim: true },
    symbol:      { type: String },
    photoUrl:    { type: String, default: '' },
    manifesto:   { type: String },

    /** Seat this candidate stands in. Empty for single-ballot elections. */
    constituencyCode: { type: String, default: '', uppercase: true, trim: true },
    constituencyName: { type: String, default: '' },
    /** Copied from the seat so results can be grouped by place. */
    state:    { type: String, default: '' },
    district: { type: String, default: '' },
    city:     { type: String, default: '' },
    village:  { type: String, default: '' },

    voteCount:   { type: Number, default: 0 },
    status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
    nominatedBy: { type: String, default: 'admin' },
    stationName: { type: String, default: '' },
    approvedBy:  { type: String, default: '' },
    approvedAt:  { type: Date, default: null },
    txHash:      { type: String },
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

CandidateSchema.index({ electionId: 1, candidateId: 1 }, { unique: true });
CandidateSchema.index({ electionId: 1, constituencyCode: 1 });
CandidateSchema.index({ electionId: 1, partyCode: 1, constituencyCode: 1 });

export default mongoose.models.Candidate ?? mongoose.model('Candidate', CandidateSchema);
