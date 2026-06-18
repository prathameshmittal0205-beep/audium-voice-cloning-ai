const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const logger = require('../utils/logger');

let store;
if (process.env.NODE_ENV === 'production') {
  const redisClient = createClient({
    url: process.env.AUDIUM_REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => logger.error({ err }, 'Redis Client Error'));
  redisClient.connect().catch(err => logger.error({ err }, 'Redis connect failed'));
  
  store = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:'
  });
}

const createRateLimiter = ({ windowMs, max, keyGenerator, message, name }) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: store ? store : undefined,
    keyGenerator: keyGenerator || ((req) => req.ip),
    handler: (req, res, next, options) => {
      logger.warn({ traceId: req.id, ip: req.ip, userId: req.user?.userId, limit: name }, 'Rate limit exceeded');
      res.status(429).json({ error: message || 'Too many requests, please try again later.' });
    }
  });
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
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: 'Upload limit exceeded. You can upload 10 files per hour.'
});

const trainingLimiter = createRateLimiter({
  name: 'training',
  windowMs: 24 * 60 * 60 * 1000,
  max: 2,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: 'Training limit exceeded. You can start 2 training jobs per 24 hours.'
});

const ttsLimiter = createRateLimiter({
  name: 'tts',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.userId || req.ip,
  message: 'TTS generation limit exceeded. You can generate 20 clips per hour.'
});

module.exports = {
  globalLimiter,
  authLimiter,
  uploadLimiter,
  trainingLimiter,
  ttsLimiter,
  redisClient
};
