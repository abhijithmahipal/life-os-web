import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

// Ensure compound index for fast queries
DocumentSchema.index({ userId: 1, category: 1 }, { unique: true });

export const UserDocument = mongoose.models.UserDocument || mongoose.model('UserDocument', DocumentSchema);
