const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');

dotenv.config({ path: '../.env' });

const REQUIRED_ENV_VARS = [
  'AUDIUM_JWT_SECRET',
  'AUDIUM_MONGODB_URI',
  'WORKER_SECRET'
];

if (process.env.NODE_ENV !== 'test') {
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      console.error(
        JSON.stringify({
          service: "audium-api",
          level: "FATAL",
          message: `Required environment variable ${key} is not set. Exiting.`
        })
      );
      process.exit(1);
    }
  }
}

const app = express();

// Connect to MongoDB unless in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Middleware
app.use(cors({
  origin: process.env.AUDIUM_ALLOWED_ORIGIN || '*'
}));
app.use(express.json());

// Structured Logging with traceId
app.use(pinoHttp({
  logger,
  genReqId: function (req, res) {
    const id = req.headers['x-trace-id'] || randomUUID();
    res.setHeader('X-Trace-Id', id);
    return id;
  },
  customProps: (req, res) => {
    return { traceId: req.id };
  }
}));

const { globalLimiter } = require('./middlewares/rateLimiter');

// Route implementations will go here
app.use('/api/', globalLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/training', require('./routes/training'));
app.use('/api/tts', require('./routes/tts'));
app.use('/api/model', require('./routes/model'));
app.use('/internal', globalLimiter, require('./routes/internal'));

app.get('/api/health', (req, res) => {
  // Advanced health check logic to be added
  res.status(200).json({ status: 'ok' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(JSON.stringify({
      service: 'audium-api',
      level: 'INFO',
      message: `Audium running locally on port ${PORT}`
    }));
  });
}

module.exports = app;
