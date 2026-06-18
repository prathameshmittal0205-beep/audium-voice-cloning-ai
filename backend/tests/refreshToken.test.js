const request = require('supertest');
const app = require('../src/index');

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

describe('Refresh Token Logic', () => {
  const testUser = {
    email: 'refresh@example.com',
    password: 'password123'
  };

  let validRefreshToken;

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app).post('/api/auth/login').send(testUser);
    validRefreshToken = loginRes.body.refreshToken;
  });

  describe('POST /api/auth/refresh', () => {
    it('should issue a new access token and rotate refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toBe(validRefreshToken);
    });

    it('should reject an invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-string' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid refresh token');
    });

    it('should reject a revoked refresh token', async () => {
      // First, logout to revoke the token
      await request(app).post('/api/auth/logout').send({ refreshToken: validRefreshToken });

      // Then try to refresh using the revoked token
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Token revoked. Please login again.');
    });

    it('should reject an expired session', async () => {
      const Session = require('../src/models/Session');
      
      // Manually expire the session in the database
      const pastDate = new Date(Date.now() - 10000000);
      await Session.updateOne({ refreshToken: validRefreshToken }, { expiresAt: pastDate });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      // Assuming your auth logic checks expiresAt or rejects if expiresAt < Date.now()
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});
