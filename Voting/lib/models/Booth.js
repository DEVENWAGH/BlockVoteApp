import mongoose from 'mongoose';

/**
 * Booth — a physical polling station for an election. A booth is a place,
 * not a ballot: any activated booth in the country loads the voter's home
 * ballot. The booth is only recorded as *where* the person voted.
 */
const BoothSchema = new mongoose.Schema(
  {
    electionId: { type: String, required: true, index: true },
    code: { type: String, default: '', uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    /** Lower-cased name used to upsert the same booth on re-activation. */
    nameKey: { type: String, required: true },
    state: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    lastActivatedAt: { type: Date, default: null },
    activations: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BoothSchema.index({ electionId: 1, nameKey: 1 }, { unique: true });

export default mongoose.models.Booth || mongoose.model('Booth', BoothSchema);
