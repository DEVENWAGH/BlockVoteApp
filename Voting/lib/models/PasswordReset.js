import mongoose from 'mongoose';

const PasswordResetSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true, trim: true },
  token:     { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ email: 1 });

export default mongoose.models.PasswordReset || mongoose.model('PasswordReset', PasswordResetSchema);
