import mongoose from 'mongoose';

/**
 * Enrollment — one person in one election.
 *
 * Holds everything that is election-specific: the on-chain nullifier and
 * registration, the ballot allowance, and where the vote was cast. It does
 * NOT copy the voter's address — that stays on the master roll (Voter.js).
 *
 * `constituencyCode` is the seat this person votes for in *this* election,
 * resolved from the master roll at enrollment time using the election level.
 */
const CapturedLocalitySchema = new mongoose.Schema(
  {
    village: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    localityType: { type: String, default: '' },
    capturedAt: { type: Date, default: null },
  },
  { _id: false },
);

const EnrollmentSchema = new mongoose.Schema(
  {
    electionId: { type: String, required: true, index: true },
    voterId: { type: String, required: true, uppercase: true, trim: true, index: true },
    voter: { type: mongoose.Schema.Types.ObjectId, ref: 'Voter', default: null },

    /** Seat for this election (from the shared Constituency list). Empty for single-ballot elections. */
    constituencyCode: { type: String, default: '', uppercase: true, trim: true },

    nullifierHash: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'registered', 'rejected'], default: 'pending' },
    registeredAt: { type: Date, default: null },
    onChainTxHash: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },

    /** Invite email with app deep link was sent */
    inviteSentAt: { type: Date, default: null },

    /** Ballots cast (app allows 2: first vote + one change). */
    votesCast: { type: Number, default: 0 },
    /** Set once a polling-station vote is cast — no further votes from any channel. */
    stationVoteFinal: { type: Boolean, default: false },
    /** Held while a ballot is in flight so a slow retry cannot cast a second one. */
    castLockUntil: { type: Date, default: null },

    /** Where the latest ballot was cast. Never changes the home seat. */
    votedAt: { type: Date, default: null },
    votedVia: { type: String, enum: ['', 'app', 'station'], default: '' },
    votedAtBoothId: { type: String, default: '' },
    votedAtBoothCode: { type: String, default: '' },
    votedAtBoothName: { type: String, default: '' },

    /** Coarse vote-time place, analytics only. Not the home address. */
    capturedLocality: { type: CapturedLocalitySchema, default: null },
  },
  { timestamps: true },
);

EnrollmentSchema.index({ electionId: 1, voterId: 1 }, { unique: true });
EnrollmentSchema.index({ electionId: 1, status: 1 });
EnrollmentSchema.index({ electionId: 1, nullifierHash: 1 });
EnrollmentSchema.index({ electionId: 1, constituencyCode: 1 });

export default mongoose.models.Enrollment || mongoose.model('Enrollment', EnrollmentSchema);
