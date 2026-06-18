// Note: In-memory storage is acceptable here because Render Free tier 
// runs exactly ONE instance with zero horizontal scaling.
let activeWorkerUrl = process.env.LOCAL_WORKER_URL || null;

module.exports = {
  getWorkerUrl: () => activeWorkerUrl,
  setWorkerUrl: (url) => {
    activeWorkerUrl = url;
  }
};
