const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  deviceInfo: {
    type: String,
    default: 'unknown'
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Automatically delete expired sessions
  },
  isRevoked: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
