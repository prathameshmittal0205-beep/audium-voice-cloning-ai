const express = require('express');
const router = express.Router();
const mlProvider = require('../services/mlProvider');
const dbService = require('../services/dbService');
const blobService = require('../services/blobService');
const authenticateToken = require('../middlewares/auth');
const { ttsLimiter } = require('../middlewares/rateLimiter');

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
    // Verify model readiness via DB (O(1) low-latency cache)
    const voiceRecord = await dbService.findVoiceByVoiceId(voiceId);
    if (!voiceRecord || !voiceRecord.isReady) {
      return res.status(400).json({ error: 'AUDIUM_MODEL_NOT_READY' });
    }

    let audioBuffer;
    try {
      const result = await mlProvider.generateSpeech({ text, voiceId, userId });
      audioBuffer = result.audioBuffer;
    } catch (error) {
      if (error.name === 'OfflineError') {
        return res.status(503).json({
          error: {
            code: 'AUDIUM_WORKER_OFFLINE',
            message: 'ML worker is not registered. Please start the local worker and register it.'
          }
        });
      }
      throw error;
    }
    
    // Save to DB
    const generation = await dbService.createGeneration({
      userId,
      voiceId,
      text,
      audioBlobUrl: '' // temp
    });

    const generationId = generation._id;
    
    // Upload buffer to Vercel Blob
    const audioBlobUrl = await blobService.uploadPublicBuffer(
      audioBuffer,
      `generations/${userId}/${generationId}.wav`,
      'audio/wav'
    );

    // Update DB with real path
    await dbService.updateGenerationAudioUrl(generationId, audioBlobUrl);

    res.status(200).json({
      audioUrl: audioBlobUrl,
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

    const { records, total } = await dbService.getGenerationsByUser(userId, page, limit);

    // Vercel Blob returns public URLs, no need to sign
    const generations = records.map((record) => {
      return {
        id: record._id,
        voiceId: record.voiceId,
        text: record.text,
        audioUrl: record.audioBlobUrl,
        createdAt: record.createdAt
      };
    });

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
