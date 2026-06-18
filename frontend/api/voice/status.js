import { verifyToken } from '../_middleware.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const auth = verifyToken(req);
  if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });

  // Simulate completion instantly for mock environment
  res.status(200).json({ jobId: req.query.jobId, status: 'completed', progress: 100 });
}
