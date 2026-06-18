const mongoose = require('mongoose');

const voiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voiceId: { type: String, required: true, unique: true },
  uploadId: { type: String, required: true },
  jobId: { type: String },
  isReady: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Voice', voiceSchema);
