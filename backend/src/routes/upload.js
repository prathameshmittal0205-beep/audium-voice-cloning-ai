const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { randomUUID } = require('crypto');
const authenticateToken = require('../middlewares/auth');
const { uploadLimiter } = require('../middlewares/rateLimiter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  }
});

// Assuming application default credentials (ADC) or explicit keys if local
const storage = new Storage();
const bucketName = process.env.AUDIUM_BUCKET_DATA || 'audium-voice-data';
const bucket = storage.bucket(bucketName);

router.post('/', authenticateToken, uploadLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing audio file' });
    }
    
    // Check basic mime type
    if (!req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ error: 'Invalid file format. Must be audio.' });
    }

    const transcript = req.body.transcript;
    if (!transcript) {
      return res.status(400).json({ error: 'Missing transcript' });
    }

    const uploadId = randomUUID();
    const userId = req.user.userId;

    const audioGcsPath = `${userId}/${uploadId}/audio.wav`;
    const transcriptGcsPath = `${userId}/${uploadId}/transcript.txt`;

    const audioBlob = bucket.file(audioGcsPath);
    const audioStream = audioBlob.createWriteStream({ resumable: false });
    
    audioStream.on('error', (err) => {
      req.log.error({ err }, 'Failed to upload audio to GCS');
      return res.status(500).json({ error: 'Storage upload failed' });
    });

    audioStream.on('finish', async () => {
      try {
        const transcriptBlob = bucket.file(transcriptGcsPath);
        await transcriptBlob.save(transcript);

        res.status(200).json({
          uploadId,
          audioGcsPath: `gs://${bucketName}/${audioGcsPath}`,
          transcriptGcsPath: `gs://${bucketName}/${transcriptGcsPath}`
        });
      } catch (err) {
        req.log.error({ err }, 'Failed to upload transcript to GCS');
        return res.status(500).json({ error: 'Storage upload failed' });
      }
    });

    audioStream.end(req.file.buffer);

  } catch (err) {
    req.log.error({ err }, 'Upload processing failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
