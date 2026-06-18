const request = require('supertest');
const app = require('../src/index');
const Voice = require('../src/models/Voice');

jest.mock('../src/middlewares/rateLimiter', () => {
  const noOpMiddleware = (req, res, next) => next();
  return {
    globalLimiter: noOpMiddleware,
    authLimiter: noOpMiddleware,
    uploadLimiter: noOpMiddleware,
    trainingLimiter: noOpMiddleware,
    ttsLimiter: noOpMiddleware,
  };
});

describe('TTS Ownership Security', () => {
  const userA = { email: 'userA@example.com', password: 'password123' };
  const userB = { email: 'userB@example.com', password: 'password123' };
  
  let tokenA, tokenB, voiceA;

  beforeEach(async () => {
    // Register and Login User A
    await request(app).post('/api/auth/register').send(userA);
    const loginA = await request(app).post('/api/auth/login').send(userA);
    tokenA = loginA.body.token;
    const userIdA = loginA.body.userId;

    // Register and Login User B
    await request(app).post('/api/auth/register').send(userB);
    const loginB = await request(app).post('/api/auth/login').send(userB);
    tokenB = loginB.body.token;

    // Create a Voice belonging to User A
    voiceA = await Voice.create({
      userId: userIdA,
      name: 'User A Voice',
      status: 'ready'
    });
  });

  describe('POST /api/tts/generate', () => {
    it('should allow User A to use their own voice', async () => {
      const res = await request(app)
        .post('/api/tts/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'Hello world',
          voiceId: voiceA._id.toString()
        });

      // The mock Vertex AI call in setup.js returns successfully
      // but wait, tts.js logic might try to hit GCS and sign URLs
      // the mocks should prevent crashes and return a generation object
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('audioUrl');
    });

    it('should block User B from using User A voice', async () => {
      const res = await request(app)
        .post('/api/tts/generate')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          text: 'Hello world',
          voiceId: voiceA._id.toString()
        });

      // User B should get 403 or 404 because they don't own voiceA
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Voice not found or not ready');
    });

    it('should return AUDIUM_MODEL_NOT_READY for unready voice', async () => {
      // Create a Voice belonging to User A but unready
      const voiceUnready = await Voice.create({
        userId: userA._id || voiceA.userId,
        name: 'User A Unready Voice',
        status: 'training'
      });

      const res = await request(app)
        .post('/api/tts/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'Hello world',
          voiceId: voiceUnready._id.toString()
        });

      expect(res.statusCode).toBe(400); // or whatever status code is mapped to AUDIUM_MODEL_NOT_READY
      expect(res.body.error).toMatch(/ready/i);
    });
  });
});
