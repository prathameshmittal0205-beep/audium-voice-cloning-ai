const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { handleUpload } = require('@vercel/blob/client');
const authenticateToken = require('../middlewares/auth');
const { uploadLimiter } = require('../middlewares/rateLimiter');

router.post('/request-url', authenticateToken, uploadLimiter, async (req, res) => {
  try {
    console.log('BLOB TOKEN exists:', !!process.env.BLOB_READ_WRITE_TOKEN);
    const body = req.body;
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          allowedContentTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'text/plain'],
          tokenPayload: JSON.stringify({ userId: req.user.userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional server-side handling when upload finishes
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    req.log.error({ error }, 'Failed to generate Vercel Blob client token');
    return res.status(400).json({ error: error.message });
  }
});

router.post('/complete', authenticateToken, uploadLimiter, async (req, res) => {
  try {
    const { audioBlobUrl, transcriptBlobUrl } = req.body;
    
    if (!audioBlobUrl || !transcriptBlobUrl) {
      return res.status(400).json({ error: 'Missing blob URLs' });
    }

    const uploadId = randomUUID();
    
    // We don't save to the database here because Voice creation
    // happens when the training is triggered via /api/training/start.
    // The previous GCS logic just returned the URLs.

    res.status(200).json({
      uploadId,
      audioGcsPath: audioBlobUrl, // Keep keys for frontend compatibility
      transcriptGcsPath: transcriptBlobUrl
    });
  } catch (err) {
    req.log.error({ err }, 'Upload complete processing failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
