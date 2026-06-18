import { verifyToken } from '../_middleware.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const auth = verifyToken(req);
  if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });

  // Mock training job response
  res.status(200).json({ jobId: 'mock_job_' + Date.now(), status: 'queued' });
}
