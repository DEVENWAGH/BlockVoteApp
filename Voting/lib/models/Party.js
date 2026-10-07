import mongoose from 'mongoose';

/**
 * Party — shared across elections. The symbol is uploaded once here and
 * every candidate of this party reuses it from a dropdown.
 */
const PartySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    /** One symbol image URL (S3 proxy path or https URL). */
    symbol: { type: String, required: true, trim: true },
    manifesto: { type: String, default: '', trim: true },
    /**
     * Independents share one "party" record but each seat may list many of
     * them, so the one-candidate-per-party-per-seat rule is skipped.
     */
    allowMultiplePerSeat: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

export default mongoose.models.Party || mongoose.model('Party', PartySchema);
