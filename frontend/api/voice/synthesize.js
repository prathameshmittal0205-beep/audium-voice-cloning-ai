import { verifyToken } from '../_middleware.js';

const MOCK_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const auth = verifyToken(req);
  if (!auth.valid) return res.status(401).json({ error: 'Unauthorized' });

  res.status(200).json({ audioContent: MOCK_WAV_BASE64 });
}
