const express = require('express');
const router = express.Router();
const { GoogleAuth } = require('google-auth-library');
const { Storage } = require('@google-cloud/storage');
const Generation = require('../models/Generation');
const Voice = require('../models/Voice');
const authenticateToken = require('../middlewares/auth');
const { ttsLimiter } = require('../middlewares/rateLimiter');

const projectId = process.env.AUDIUM_VERTEX_PROJECT_ID;
const location = process.env.AUDIUM_VERTEX_LOCATION || 'us-central1';
const endpointId = process.env.AUDIUM_VERTEX_ENDPOINT_ID;
const bucketGenerated = process.env.AUDIUM_BUCKET_GENERATED || 'audium-generated';
const bucketModels = process.env.AUDIUM_BUCKET_MODELS || 'audium-models';

const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
});
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

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/${endpointId}:predict`;

    const payload = {
      instances: [
        {
          text,
          voiceId: voiceId,
          userId: userId, // Ensure endpoint uses right user model
          language: "en"
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ err: errText }, 'Inference pipeline failure');
      return res.status(500).json({ error: 'Inference pipeline failure' });
    }

    const data = await response.json();
    const base64Audio = data.predictions && data.predictions[0] && data.predictions[0].audio_base64;
    
    if (!base64Audio) {
      return res.status(500).json({ error: 'Invalid response from inference endpoint' });
    }

    // Decode base64 to buffer
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    
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
