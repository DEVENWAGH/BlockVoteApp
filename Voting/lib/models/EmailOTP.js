import mongoose from 'mongoose';

const EmailOTPSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true },
  otp:       { type: String, required: true },
  electionId: { type: String, default: '' },
  purpose:   {
    type: String,
    enum: ['vote', 'admin-login', 'admin-signup'],
    default: 'vote',
  },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
  attempts:  { type: Number, default: 0 },
}, { timestamps: true });

EmailOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EmailOTPSchema.index({ email: 1, purpose: 1, electionId: 1 });

export default mongoose.models.EmailOTP || mongoose.model('EmailOTP', EmailOTPSchema);
