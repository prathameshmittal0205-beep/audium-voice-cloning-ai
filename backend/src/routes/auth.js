const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dbService = require('../services/dbService');
const { authLimiter } = require('../middlewares/rateLimiter');

// Simple email validation regex
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.AUDIUM_JWT_SECRET,
    { expiresIn: '7d' } // 7 days access token
  );
  
  const refreshToken = crypto.randomBytes(40).toString('hex');
  return { accessToken, refreshToken };
};

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Register body:', JSON.stringify(req.body));
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const existingUser = await dbService.findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await dbService.createUser({ email: normalizedEmail, hashedPassword });
    res.status(201).json({ message: 'Registration successful', userId: user._id });
  } catch (err) {
    req.log.error({ err }, 'Registration failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const user = await dbService.findUserByEmail(normalizedEmail);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const { accessToken, refreshToken } = generateTokens(user);
    
    // Calculate 7 days expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save session
    await dbService.createSession({
      userId: user._id,
      refreshToken,
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip,
      expiresAt
    });

    res.status(200).json({ token: accessToken, refreshToken, userId: user._id });
  } catch (err) {
    req.log.error({ err }, 'Login failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const session = await dbService.findSessionByToken(refreshToken);
    if (!session) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (session.isRevoked) {
      req.log.warn({ userId: session.userId }, 'Attempted use of revoked refresh token');
      return res.status(401).json({ error: 'Token revoked. Please login again.' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = await dbService.findUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Token Rotation
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    // Revoke old and create new
    await dbService.updateSessionRevoked(refreshToken, true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await dbService.createSession({
      userId: user._id,
      refreshToken: newRefreshToken,
      deviceInfo: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip,
      expiresAt
    });

    res.status(200).json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    req.log.error({ err }, 'Refresh token failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await dbService.updateSessionRevoked(refreshToken, true);
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    req.log.error({ err }, 'Logout failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
