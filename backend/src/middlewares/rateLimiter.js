const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// MemoryStore is safe on Vercel — single instance per cold start.
// For high-traffic production, upgrade to Vercel KV-backed store.

const createRateLimiter = ({ windowMs, max, keyGenerator, message, name }) => {
  const options = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      logger.warn({ traceId: req.id, ip: req.ip, userId: req.user?.userId, limit: name }, 'Rate limit exceeded');
      res.status(429).json({ error: message || 'Too many requests, please try again later.' });
    }
  };
  if (keyGenerator) {
    options.keyGenerator = keyGenerator;
  }
  return rateLimit(options);
};

const globalLimiter = createRateLimiter({
  name: 'global',
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Global rate limit exceeded.'
});

const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts. Try again in 15 minutes.'
});

const uploadLimiter = createRateLimiter({
  name: 'upload',
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req, res) => {
    if (req.user?.userId) return req.user.userId;
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  },
  message: 'Upload limit exceeded. You can upload 10 files per hour.'
});

const trainingLimiter = createRateLimiter({
  name: 'training',
  windowMs: 24 * 60 * 60 * 1000,
  max: 2,
  keyGenerator: (req, res) => {
    if (req.user?.userId) return req.user.userId;
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  },
  message: 'Training limit exceeded. You can start 2 training jobs per 24 hours.'
});

const ttsLimiter = createRateLimiter({
  name: 'tts',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req, res) => {
    if (req.user?.userId) return req.user.userId;
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  },
  message: 'TTS generation limit exceeded. You can generate 20 clips per hour.'
});

module.exports = {
  globalLimiter,
  authLimiter,
  uploadLimiter,
  trainingLimiter,
  ttsLimiter
};
