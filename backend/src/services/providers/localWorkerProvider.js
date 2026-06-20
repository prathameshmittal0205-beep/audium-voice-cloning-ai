const workerRegistry = require('../workerRegistry');

class OfflineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OfflineError';
  }
}

class LocalWorkerProvider {
  constructor() {
    this.workerHealthCache = { status: 'offline', lastChecked: 0 };
    this.healthCheckPromise = null;
  }

  async _checkHealth() {
    const workerUrl = await workerRegistry.getWorkerUrl();
    if (!workerUrl) {
      throw new OfflineError('Voice cloning engine is currently unavailable.');
    }

    const now = Date.now();
    if (now - this.workerHealthCache.lastChecked < 60000) {
      if (this.workerHealthCache.status === 'offline') {
        throw new OfflineError('Voice cloning engine is currently unavailable.');
      }
      return; // cached healthy
    }

    if (this.healthCheckPromise) {
      return this.healthCheckPromise; // coalesce
    }

    this.healthCheckPromise = (async () => {
      try {
        const response = await fetch(`${workerUrl}/health`, {
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          this.workerHealthCache = { status: 'online', lastChecked: Date.now() };
        } else {
          throw new Error('Worker health check failed');
        }
      } catch (err) {
        this.workerHealthCache = { status: 'offline', lastChecked: Date.now() };
        throw new OfflineError('Voice cloning engine is currently unavailable.');
      } finally {
        this.healthCheckPromise = null;
      }
    })();

    return this.healthCheckPromise;
  }

  _forceOffline() {
    this.workerHealthCache = { status: 'offline', lastChecked: Date.now() };
  }

  async startTraining({ uploadId, userId, voiceId, audioUrl, transcriptUrl }) {
    await this._checkHealth();
    const workerUrl = await workerRegistry.getWorkerUrl();
    const jobId = require('crypto').randomUUID();
    
    try {
      const response = await fetch(`${workerUrl}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, audio_url: audioUrl, voice_id: voiceId })
      });

      if (!response.ok) {
        throw new Error('Failed to start training on local worker');
      }

      const data = await response.json();
      return { jobId: data.job_id || data.jobId || jobId, status: data.status };
    } catch (err) {
      this._forceOffline();
      throw err;
    }
  }

  async getTrainingStatus(jobId) {
    // We don't necessarily need to check health here, if offline we just throw or say failed/offline
    const workerUrl = await workerRegistry.getWorkerUrl();
    if (!workerUrl) throw new OfflineError('Voice cloning engine is currently unavailable.');

    try {
      const response = await fetch(`${workerUrl}/training-status/${jobId}`);
      if (response.status === 404) {
        // Worker lost the job (e.g., restarted)
        return { status: 'FAILED', inferredProgress: 0 };
      }
      if (!response.ok) {
        throw new Error('Failed to get training status from local worker');
      }

      const data = await response.json();
      let inferredProgress = 0;
      let mappedStatus = 'QUEUED';
      
      if (data.status === 'completed') {
        inferredProgress = 100;
        mappedStatus = 'COMPLETED';
      } else if (data.status === 'failed') {
        inferredProgress = 0;
        mappedStatus = 'FAILED';
      } else if (data.status === 'running') {
        inferredProgress = 50; // simple heuristic for local worker
        mappedStatus = 'RUNNING';
      }

      return { status: mappedStatus, inferredProgress };
    } catch (err) {
      this._forceOffline();
      throw new OfflineError('Voice cloning engine is currently unavailable.');
    }
  }

  async generateSpeech({ text, voiceId, userId }) {
    await this._checkHealth();
    const workerUrl = await workerRegistry.getWorkerUrl();

    try {
      const response = await fetch(`${workerUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: voiceId, user_id: userId })
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech on local worker');
      }

      const data = await response.json();
      if (data.status !== 'success') {
        throw new Error('Local worker reported failure');
      }

      // Base64 or direct URL? For fallback compatibility with vertex provider, 
      // let's return base64 audio if it exists, or audioBuffer directly.
      // If the local worker uploads to R2 and gives a URL, we need to handle that in the route.
      // Wait, tts.js assumes audioBuffer currently.
      // We will have local worker return base64Audio to maintain contract.
      if (!data.base64Audio) {
         throw new Error('Invalid response from local worker endpoint');
      }
      
      const audioBuffer = Buffer.from(data.base64Audio, 'base64');
      return { status: 'success', audioBuffer };
    } catch (err) {
      this._forceOffline();
      throw new OfflineError('Voice cloning engine is currently unavailable.');
    }
  }
}

module.exports = LocalWorkerProvider;
module.exports.OfflineError = OfflineError;
