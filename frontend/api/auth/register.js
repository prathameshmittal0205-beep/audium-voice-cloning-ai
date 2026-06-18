export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  res.status(200).json({ token: 'mock_jwt_123', userId: 'demo_user', name: 'Audium Local Tester' });
}
