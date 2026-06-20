const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  
  if (token == null) {
    logger.warn({ traceId: req.id }, 'Authentication failed: No token provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, process.env.AUDIUM_JWT_SECRET || 'secret', (err, user) => {
    if (err) {
      logger.warn({ traceId: req.id, err }, 'Authentication failed: Invalid token');
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
