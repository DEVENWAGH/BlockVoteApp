import mongoose from 'mongoose';

/**
 * Platform election admin (web). Voters never use this model —
 * they vote only via the mobile app.
 */
const AdminSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:    { type: String, default: null },
  googleId:        { type: String, default: null },
  isEmailVerified: { type: Boolean, default: false },
  isActive:        { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
