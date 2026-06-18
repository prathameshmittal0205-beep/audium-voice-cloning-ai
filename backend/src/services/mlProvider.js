const VertexProvider = require('./providers/vertexProvider');
const LocalWorkerProvider = require('./providers/localWorkerProvider');

class MLProviderFactory {
  constructor() {
    const providerType = process.env.ML_PROVIDER || 'vertex';
    
    if (providerType === 'local') {
      this.provider = new LocalWorkerProvider();
    } else {
      this.provider = new VertexProvider();
    }
  }

  async startTraining(payload) {
    return this.provider.startTraining(payload);
  }

  async getTrainingStatus(jobId) {
    return this.provider.getTrainingStatus(jobId);
  }

  async generateSpeech(payload) {
    return this.provider.generateSpeech(payload);
  }
}

module.exports = new MLProviderFactory();
