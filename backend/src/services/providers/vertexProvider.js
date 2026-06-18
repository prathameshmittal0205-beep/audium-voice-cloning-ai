const { GoogleAuth } = require('google-auth-library');

class VertexProvider {
  constructor() {
    this.projectId = process.env.AUDIUM_VERTEX_PROJECT_ID;
    this.location = process.env.AUDIUM_VERTEX_LOCATION || 'us-central1';
    this.endpointId = process.env.AUDIUM_VERTEX_ENDPOINT_ID;
    this.containerImage = process.env.AUDIUM_ARTIFACT_REGISTRY_IMAGE;
    this.bucketData = process.env.AUDIUM_BUCKET_DATA || 'audium-voice-data';
    this.bucketModels = process.env.AUDIUM_BUCKET_MODELS || 'audium-models';
    this.auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
  }

  async startTraining({ uploadId, userId, voiceId, traceId }) {
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/customJobs`;
    
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const payload = {
      displayName: `audium-xtts-finetune-${uploadId}`,
      jobSpec: {
        workerPoolSpecs: [
          {
            machineSpec: {
              machineType: 'n1-standard-8',
              acceleratorType: 'NVIDIA_TESLA_T4',
              acceleratorCount: 1
            },
            replicaCount: 1,
            containerSpec: {
              imageUri: this.containerImage,
              env: [
                { name: 'USER_ID', value: userId },
                { name: 'UPLOAD_ID', value: uploadId },
                { name: 'VOICE_ID', value: voiceId },
                { name: 'AUDIUM_BUCKET_DATA', value: this.bucketData },
                { name: 'AUDIUM_BUCKET_MODELS', value: this.bucketModels },
                { name: 'TRACE_ID', value: traceId || '' }
              ]
            }
          }
        ],
        scheduling: {
          timeout: '14400s', // 4 hours
          restartJobOnCustomJobNodeRestart: false
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger Vertex AI job: ${errorText}`);
    }

    const data = await response.json();
    const jobId = data.name.split('/').pop();

    return { jobId, status: 'QUEUED' };
  }

  async getTrainingStatus(jobId) {
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/customJobs/${jobId}`;
    
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
      }
    });

    if (!response.ok) {
      throw new Error('Job not found');
    }

    const data = await response.json();
    const state = data.state;
    
    let inferredProgress = 0;
    let mappedStatus = 'QUEUED';
    
    if (state === 'JOB_STATE_SUCCEEDED') {
      inferredProgress = 100;
      mappedStatus = 'COMPLETED';
    }
    else if (state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') {
      inferredProgress = 0;
      mappedStatus = 'FAILED';
    }
    else if (state === 'JOB_STATE_RUNNING') {
      const startTime = new Date(data.startTime).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / 60000;
      inferredProgress = Math.min(95, Math.floor((elapsedMinutes / 30) * 100));
      mappedStatus = 'RUNNING';
    }

    return {
      status: mappedStatus,
      rawState: state,
      inferredProgress
    };
  }

  async generateSpeech({ text, voiceId, userId }) {
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/endpoints/${this.endpointId}:predict`;

    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();

    const payload = {
      instances: [
        {
          text,
          voiceId,
          userId,
          language: "en"
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResponse.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Inference pipeline failure: ${errText}`);
    }

    const data = await response.json();
    const base64Audio = data.predictions && data.predictions[0] && data.predictions[0].audio_base64;
    
    if (!base64Audio) {
      throw new Error('Invalid response from inference endpoint');
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64');
    
    return {
      status: 'success',
      audioBuffer
    };
  }
}

module.exports = VertexProvider;
