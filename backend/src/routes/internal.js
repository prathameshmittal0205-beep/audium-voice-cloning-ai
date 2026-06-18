const express = require('express');
const router = express.Router();
const workerRegistry = require('../services/workerRegistry');

if (process.env.NODE_ENV === "production" && !process.env.WORKER_SECRET) {
  throw new Error("WORKER_SECRET required in production");
}

const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';

function isValidWorkerUrl(url) {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['https:', 'http:'];
    const blockedHosts = [
      '169.254.169.254',   // AWS/GCP metadata
      '169.254.0.0',
      'metadata.google.internal',
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1'
    ];
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (blockedHosts.some(h => parsed.hostname.includes(h))) return false;
    // For this project: only accept ngrok or known tunnel domains
    const allowedDomains = ['.ngrok.io', '.ngrok-free.app', '.ngrok.app'];
    if (!allowedDomains.some(d => parsed.hostname.endsWith(d))) return false;
    return true;
  } catch {
    return false;
  }
}

router.post('/register-worker', (req, res) => {
  const { workerUrl, secret } = req.body;

  if (secret !== WORKER_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!workerUrl) {
    return res.status(400).json({ error: 'workerUrl is required' });
  }

  if (!isValidWorkerUrl(workerUrl)) {
    return res.status(400).json({
      error: {
        code: "AUDIUM_INVALID_WORKER_URL",
        message: "Worker URL must be a valid Ngrok URL."
      }
    });
  }

  workerRegistry.setWorkerUrl(workerUrl);
  req.log.info({ workerUrl }, 'Local ML Worker registered successfully');

  res.status(200).json({ status: 'success', message: 'Worker registered' });
});

module.exports = router;
