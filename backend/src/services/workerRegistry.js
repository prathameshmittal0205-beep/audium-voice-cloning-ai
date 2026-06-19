// Note: In-memory storage is used here as requested. Vercel Functions are stateless,
// so this relies on warm-start memory caching or single-instance execution during testing.
let activeWorkerUrl = process.env.LOCAL_WORKER_URL || null;

module.exports = {
  getWorkerUrl: () => activeWorkerUrl,
  setWorkerUrl: (url) => {
    activeWorkerUrl = url;
  }
};
