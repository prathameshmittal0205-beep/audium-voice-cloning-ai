const request = require('supertest');
const express = require('express');

// We create a mock app with just the express-rate-limit (using memory store) to prove the 429 logic
const rateLimit = require('express-rate-limit');

const testLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2, // limit each IP to 2 requests
  message: 'Too many requests'
});

const app = express();
app.post('/api/auth/login', testLimiter, (req, res) => {
  res.status(200).json({ success: true });
});

describe('Rate Limiting', () => {
  it('should return 429 Too Many Requests when limit is exceeded', async () => {
    // 1st request (Allowed)
    let res = await request(app).post('/api/auth/login');
    expect(res.statusCode).toBe(200);

    // 2nd request (Allowed)
    res = await request(app).post('/api/auth/login');
    expect(res.statusCode).toBe(200);

    // 3rd request (Blocked)
    res = await request(app).post('/api/auth/login');
    expect(res.statusCode).toBe(429);
    expect(res.text).toContain('Too many requests');
  });
});
