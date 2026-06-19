const express = require('express');
const router = express.Router();
const mlProvider = require('../services/mlProvider');
const authenticateToken = require('../middlewares/auth');
const { trainingLimiter } = require('../middlewares/rateLimiter');
const dbService = require('../services/dbService');

router.post('/start', authenticateToken, trainingLimiter, async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ error: 'Invalid uploadId' });
    }

    const userId = req.user.userId;
    const voiceId = `voice_${uploadId}`;

    let jobId, status;
    try {
      const result = await mlProvider.startTraining({ uploadId, userId, voiceId, traceId: req.id });
      jobId = result.jobId;
      status = result.status;
    } catch (error) {
      if (error.name === 'OfflineError') {
        return res.status(503).json({ status: 'offline', message: error.message });
      }
      throw error;
    }

    // Persist voice state to DB
    await dbService.createVoice({
      userId,
      voiceId,
      uploadId,
      jobId,
      isReady: false
    });

    res.status(202).json({ jobId, voiceId, status: 'QUEUED' });

  } catch (err) {
    req.log.error({ err }, 'Training trigger failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    let mappedStatus, inferredProgress, state;
    try {
      const result = await mlProvider.getTrainingStatus(jobId);
      mappedStatus = result.status;
      inferredProgress = result.inferredProgress;
      state = result.rawState || mappedStatus;
    } catch (error) {
      if (error.name === 'OfflineError') {
        return res.status(503).json({ status: 'offline', message: error.message });
      }
      throw error;
    }

    if (mappedStatus === 'COMPLETED') {
      // Update global readiness cache in DB
      await dbService.updateVoiceReadinessByJobId(jobId, true);
    }

    res.status(200).json({
      jobId,
      state,
      inferredProgress
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to retrieve job status');
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

module.exports = router;
