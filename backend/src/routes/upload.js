const express = require('express');
const router = express.Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const authenticateToken = require('../middlewares/auth');
const { uploadLimiter } = require('../middlewares/rateLimiter');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', authenticateToken, uploadLimiter, upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'transcript', maxCount: 1 }
]), async (req, res) => {
  try {
    const audioFile = req.files['audio'] ? req.files['audio'][0] : null;
    const transcriptFile = req.files['transcript'] ? req.files['transcript'][0] : null;

    if (!audioFile || !transcriptFile) {
      return res.status(400).json({ error: 'Audio and transcript files are required' });
    }

    const userId = req.user.userId;
    const uploadId = require('crypto').randomUUID();

    const audioBlob = await put(
      `audio/${userId}/${uploadId}.wav`,
      audioFile.buffer,
      { access: 'public', contentType: 'audio/wav' }
    );

    const transcriptBlob = await put(
      `audio/${userId}/${uploadId}.txt`,
      transcriptFile.buffer,
      { access: 'public', contentType: 'text/plain' }
    );

    res.status(202).json({
      uploadId,
      audioUrl: audioBlob.url,
      transcriptUrl: transcriptBlob.url
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.log) {
      req.log.error({ err }, 'Upload processing failed');
    }
    res.status(500).json({ error: { code: 'AUDIUM_UPLOAD_FAILED', message: err.message } });
  }
});

module.exports = router;
