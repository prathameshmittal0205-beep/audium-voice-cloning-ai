const express = require('express');
const router = express.Router();
const { GoogleAuth } = require('google-auth-library');
const authenticateToken = require('../middlewares/auth');
const { trainingLimiter } = require('../middlewares/rateLimiter');
const Voice = require('../models/Voice');

const projectId = process.env.AUDIUM_VERTEX_PROJECT_ID;
const location = process.env.AUDIUM_VERTEX_LOCATION || 'us-central1';
const bucketData = process.env.AUDIUM_BUCKET_DATA || 'audium-voice-data';
const bucketModels = process.env.AUDIUM_BUCKET_MODELS || 'audium-models';
const containerImage = process.env.AUDIUM_ARTIFACT_REGISTRY_IMAGE;

const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

router.post('/start', authenticateToken, trainingLimiter, async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ error: 'Invalid uploadId' });
    }

    const userId = req.user.userId;
    const voiceId = `voice_${uploadId}`;

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/customJobs`;
    
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const payload = {
      displayName: `audium-xtts-finetune-${uploadId}`,
      jobSpec: {
        workerPoolSpecs: [
          {
            machineSpec: {
              machineType: 'n1-standard-8',
              acceleratorType: 'NVIDIA_TESLA_T4',
              acceleratorCount: 1
            },
            replicaCount: 1,
            containerSpec: {
              imageUri: containerImage,
              env: [
                { name: 'USER_ID', value: userId },
                { name: 'UPLOAD_ID', value: uploadId },
                { name: 'VOICE_ID', value: voiceId },
                { name: 'AUDIUM_BUCKET_DATA', value: bucketData },
                { name: 'AUDIUM_BUCKET_MODELS', value: bucketModels },
                { name: 'TRACE_ID', value: req.id }
              ]
            }
          }
        ],
        scheduling: {
          timeout: '14400s', // 4 hours
          restartJobOnCustomJobNodeRestart: false
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ err: errorText }, 'Failed to trigger Vertex AI job');
      return res.status(500).json({ error: 'Failed to trigger Vertex AI job' });
    }

    const data = await response.json();
    const jobId = data.name.split('/').pop();

    // Persist voice state to DB
    await Voice.create({
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
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/customJobs/${jobId}`;
    
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
      }
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const data = await response.json();
    
    // Inferred progress heuristic
    let inferredProgress = 0;
    const state = data.state;
    if (state === 'JOB_STATE_SUCCEEDED') {
      inferredProgress = 100;
      // Update global readiness cache in DB
      await Voice.findOneAndUpdate({ jobId }, { isReady: true });
    }
    else if (state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') inferredProgress = 0;
    else if (state === 'JOB_STATE_RUNNING') {
      const startTime = new Date(data.startTime).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / 60000;
      // Heuristic: assume 30 minute training
      inferredProgress = Math.min(95, Math.floor((elapsedMinutes / 30) * 100));
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
