// _middleware.js is not an edge middleware here, but a reusable util for other serverless functions
export function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }
  const token = authHeader.split(' ')[1];
  // Simple mock verification
  if (token === 'mock_jwt_123') {
    return { valid: true, userId: 'demo_user' };
  }
  return { valid: false };
}
