import mongoose from "mongoose";

const ElectionSchema = new mongoose.Schema(
  {
    electionId: { type: String, required: true, unique: true, index: true },
    /** Web admin who created this election */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },

    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    // 0 = Registration, 1 = Voting, 2 = Completed
    phase: { type: Number, default: 0, enum: [0, 1, 2] },
    txHash: { type: String },
    blockNumber: { type: Number },
    candidateCount: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },

    guardianApproved: { type: Boolean, default: false },
    guardianApprovedBy: { type: String, default: "" },
    guardianApprovedAt: { type: Date, default: null },
    pendingApproval: { type: Boolean, default: false },

    ipfsCid: { type: String, default: "" },
  },
  { timestamps: true },
);

ElectionSchema.index({ createdBy: 1, phase: 1 });
ElectionSchema.index({ pendingApproval: 1, guardianApproved: 1 });

export default mongoose.models.Election ??
  mongoose.model("Election", ElectionSchema);
