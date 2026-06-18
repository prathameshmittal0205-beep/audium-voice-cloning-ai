const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  voiceId: { 
    type: String, 
    required: true 
  },
  text: { 
    type: String, 
    required: true, 
    maxlength: 500 
  },
  audioGcsPath: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

generationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Generation', generationSchema);
