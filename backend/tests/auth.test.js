const request = require('supertest');
const app = require('../src/index');
const User = require('../src/models/User');

// Mock rateLimiter middlewares to allow infinite requests during tests
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

describe('Authentication Flow', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message', 'Registration successful');
      expect(res.body).toHaveProperty('userId');

      const user = await User.findOne({ email: testUser.email });
      expect(user).toBeTruthy();
      expect(user.password).not.toBe(testUser.password);
      expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it('should fail if email is already registered', async () => {
      // Register first time
      await request(app).post('/api/auth/register').send(testUser);
      
      // Register second time
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'User already exists');
    });

    it('should fail with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid', password: 'password123' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid email format');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(testUser);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('userId');
    });

    it('should fail with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('should fail with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notfound@example.com', password: 'password123' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid email or password');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout', async () => {
      // Register and login
      await request(app).post('/api/auth/register').send(testUser);
      const loginRes = await request(app).post('/api/auth/login').send(testUser);
      const refreshToken = loginRes.body.refreshToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');
    });
  });
});
