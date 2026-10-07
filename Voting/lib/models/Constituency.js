import mongoose from 'mongoose';

export const SEAT_LEVELS = ['panchayat', 'municipal', 'assembly', 'loksabha'];

/**
 * Constituency — a shared seat list. Seats are not tied to one election so
 * the master roll can reference them by code for every election.
 *
 * - loksabha:  a parliamentary seat (state)
 * - assembly:  an assembly seat (state, district); parentCode = parliamentary seat
 * - municipal: a city ward (state, district, city, ward)
 * - panchayat: a village / gram-panchayat ward (state, district, village, ward)
 */
const ConstituencySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    level: { type: String, enum: SEAT_LEVELS, required: true, index: true },
    state: { type: String, required: true, trim: true },
    district: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    village: { type: String, default: '', trim: true },
    ward: { type: String, default: '', trim: true },
    /** Roll-up: an assembly seat can point at its parliamentary seat. */
    parentCode: { type: String, default: '', uppercase: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

ConstituencySchema.index({ level: 1, state: 1, district: 1 });

export default mongoose.models.Constituency || mongoose.model('Constituency', ConstituencySchema);
