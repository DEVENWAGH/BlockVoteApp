import mongoose from 'mongoose';

const VoterSchema = new mongoose.Schema({
  electionId:    { type: String, required: true, index: true },

  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, lowercase: true, trim: true },
  phone:         { type: String, default: '' },
  gender:        { type: String, default: '' },
  age:           { type: Number, default: null },
  memberId:      { type: String, default: '' },
  region:        { type: String, default: '', trim: true },
  state:         { type: String, default: '', trim: true },
  city:          { type: String, default: '', trim: true },
  village:       { type: String, default: '', trim: true },
  localityType:  { type: String, default: '', trim: true },
  cityTier:      { type: String, default: '', trim: true },
  locationCapturedAt: { type: Date, default: null },

  nullifierHash: { type: String, default: '' },
  status:        { type: String, enum: ['pending', 'registered', 'rejected'], default: 'pending' },
  registeredAt:  { type: Date },
  onChainTxHash: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },

  /** Invite email with app deep link was sent */
  inviteSentAt:  { type: Date, default: null },

  /** Ballots cast (app allows 2: first vote + one change). */
  votesCast:        { type: Number, default: 0 },
  /** Set once a polling-station vote is cast — no further votes from any channel. */
  stationVoteFinal: { type: Boolean, default: false },
  /** Held while a ballot is in flight so a slow retry cannot cast a second one. */
  castLockUntil: { type: Date, default: null },
}, { timestamps: true });

VoterSchema.index({ electionId: 1, email: 1 }, { unique: true });
VoterSchema.index({ electionId: 1, status: 1 });
VoterSchema.index({ electionId: 1, nullifierHash: 1 });

export default mongoose.models.Voter || mongoose.model('Voter', VoterSchema);
