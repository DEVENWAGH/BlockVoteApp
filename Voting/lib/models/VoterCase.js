import mongoose from 'mongoose';

/**
 * VoterCase — a roll row a guardian must look at before it can be used.
 *
 * - missing:   required fields are blank or the seat code is unknown.
 *              The guardian can only send it back. It is never added.
 * - duplicate: the new row clashes with someone already on the roll.
 *              The guardian chooses "keep existing" or "use the new details".
 *              Using the new details updates that one master row.
 *
 * While a case is open the person is not enrolled and cannot vote.
 */
const VoterCaseSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['missing', 'duplicate'], required: true, index: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },

    /** Plain-language reasons shown to the guardian. */
    reasons: { type: [String], default: [] },
    /** What matched: 'voterId' | 'email' | 'phone+name' | 'file' */
    matchedOn: { type: [String], default: [] },

    /** The proposed row, normalized. */
    newRow: { type: Object, default: {} },
    /** The person already on the roll (duplicate cases). */
    existingVoterId: { type: String, default: '', uppercase: true, index: true },
    existingSnapshot: { type: Object, default: null },

    sourceFile: { type: String, default: '' },
    rowNumber: { type: Number, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

    resolution: { type: String, enum: ['', 'keep_existing', 'use_new', 'sent_back'], default: '' },
    resolvedBy: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' },
  },
  { timestamps: true },
);

VoterCaseSchema.index({ status: 1, 'newRow.voterId': 1 });

export default mongoose.models.VoterCase || mongoose.model('VoterCase', VoterCaseSchema);
