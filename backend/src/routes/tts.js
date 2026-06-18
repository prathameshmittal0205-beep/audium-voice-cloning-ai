const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const mlProvider = require('../services/mlProvider');
const Generation = require('../models/Generation');
const Voice = require('../models/Voice');
const authenticateToken = require('../middlewares/auth');
const { ttsLimiter } = require('../middlewares/rateLimiter');

const bucketGenerated = process.env.AUDIUM_BUCKET_GENERATED || 'audium-generated';

const storage = new Storage();
const bucket = storage.bucket(bucketGenerated);

router.post('/generate', authenticateToken, ttsLimiter, async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text || !voiceId) {
      return res.status(400).json({ error: 'Missing text or voiceId' });
    }
    if (text.length > 250) {
      return res.status(400).json({ error: 'Text must be 250 characters or less' });
    }

    const userId = req.user.userId;

    // Strict Ownership Check (prevent cross-user access)
    // Verify model readiness via DB (O(1) low-latency cache) instead of GCS
    const voiceRecord = await Voice.findOne({ voiceId });
    if (!voiceRecord || !voiceRecord.isReady) {
      return res.status(400).json({ error: 'AUDIUM_MODEL_NOT_READY' });
    }

    let audioBuffer;
    try {
      const result = await mlProvider.generateSpeech({ text, voiceId, userId });
      audioBuffer = result.audioBuffer;
    } catch (error) {
      if (error.name === 'OfflineError') {
        return res.status(503).json({ status: 'offline', message: error.message });
      }
      throw error;
    }
    
    // Save to Mongo
    const generation = new Generation({
      userId,
      voiceId,
      text,
      audioGcsPath: '' // temp
    });
    await generation.save();

    const generationId = generation._id.toString();
    const gcsPath = `${userId}/${voiceId}/${generationId}.wav`;
    
    // Upload buffer to GCS
    const file = bucket.file(gcsPath);
    await file.save(audioBuffer, { contentType: 'audio/wav' });

    // Update mongo with real path
    generation.audioGcsPath = `gs://${bucketGenerated}/${gcsPath}`;
    await generation.save();

    // Generate ephemeral signed URL (15 mins)
    const [urlSigned] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });

    res.status(200).json({
      audioUrl: urlSigned,
      generationId
    });

  } catch (err) {
    req.log.error({ err }, 'TTS Generation failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Generation.countDocuments({ userId });
    const records = await Generation.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Regenerate signed URLs dynamically
    const generations = await Promise.all(records.map(async (record) => {
      // Parse gs:// bucket and path
      // Expected format: gs://audium-generated/...
      const pathParts = record.audioGcsPath.replace('gs://', '').split('/');
      const bName = pathParts[0]; // audium-generated
      const objectPath = pathParts.slice(1).join('/');

      const file = storage.bucket(bName).file(objectPath);
      let urlSigned = null;
      try {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
        urlSigned = url;
      } catch (e) {
        req.log.warn({ err: e }, 'Failed to sign url for history item');
      }

      return {
        id: record._id,
        voiceId: record.voiceId,
        text: record.text,
        audioUrl: urlSigned,
        createdAt: record.createdAt
      };
    }));

    res.status(200).json({
      generations,
      total,
      page,
      limit
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch history');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
