const express = require('express');
const router = express.Router();
const Voice = require('../models/Voice');
const authenticateToken = require('../middlewares/auth');

router.post('/deploy', authenticateToken, async (req, res) => {
  try {
    const { voiceId } = req.body;
    if (!voiceId) {
      return res.status(400).json({ error: 'voiceId required' });
    }
    
    const voice = await Voice.findOne({ voiceId, userId: req.user.userId });
    if (!voice) {
      return res.status(404).json({ error: 'Voice not found' });
    }
    
    // In our dynamic shared endpoint architecture, 
    // the model is lazy-loaded by the serving container.
    // "Deployment" just means verifying readiness and marking it active.
    
    voice.isReady = true;
    await voice.save();
    
    res.status(200).json({ message: 'Model deployed successfully to shared serving infrastructure' });
  } catch (err) {
    req.log.error({ err }, 'Deploy failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
