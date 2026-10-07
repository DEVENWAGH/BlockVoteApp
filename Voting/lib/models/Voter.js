import mongoose from 'mongoose';

/**
 * Voter — the master electoral roll. One row per person, keyed by voter ID (EPIC).
 *
 * Home location lives here, not on the election. An election only *enrolls*
 * people from this roll (see Enrollment.js), so nobody is typed in twice.
 *
 * These fields come from the uploaded roll and must never be overwritten by
 * vote-time GPS. Coarse vote-time location is stored on the enrollment as
 * `capturedLocality` for analytics only.
 */
const VoterSchema = new mongoose.Schema(
  {
    voterId: { type: String, required: true, unique: true, uppercase: true, trim: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, index: true },
    gender: { type: String, default: '', trim: true },
    age: { type: Number, default: null },

    /** Home place from the roll. */
    state: { type: String, default: '', trim: true, index: true },
    district: { type: String, default: '', trim: true, index: true },
    city: { type: String, default: '', trim: true },
    village: { type: String, default: '', trim: true },
    ward: { type: String, default: '', trim: true },
    partNo: { type: String, default: '', trim: true },
    homePollingStation: { type: String, default: '', trim: true },

    /** Home seats — codes from the shared Constituency list. */
    assemblyConstituency: { type: String, default: '', trim: true, uppercase: true, index: true },
    parliamentaryConstituency: { type: String, default: '', trim: true, uppercase: true, index: true },

    /** Optional analytics labels (never used for eligibility). */
    localityType: { type: String, default: '', trim: true },
    cityTier: { type: String, default: '', trim: true },

    source: { type: String, enum: ['csv', 'manual', 'migration'], default: 'csv' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    lastImportedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

VoterSchema.index({ state: 1, district: 1, city: 1 });
VoterSchema.index({ state: 1, district: 1, village: 1 });
VoterSchema.index({ name: 'text', email: 'text', voterId: 'text' }, { name: 'roll_search' });

export default mongoose.models.Voter || mongoose.model('Voter', VoterSchema);
