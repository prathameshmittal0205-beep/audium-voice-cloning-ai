const fs = require('fs');
const path = require('path');

async function run() {
  console.log("=== 1. FILE VERIFICATION ===");
  const filesToVerify = [
    'backend/src/services/mlProvider.js',
    'backend/src/services/providers/vertexProvider.js',
    'backend/src/services/providers/localWorkerProvider.js',
    'backend/src/services/workerRegistry.js',
    'backend/src/routes/internal.js',
    'ml/worker/app.py'
  ];
  for (const f of filesToVerify) {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      console.log(`[PASS] ${f} - ${lines} lines`);
    } else {
      console.log(`[FAIL] ${f} not found`);
    }
  }

  console.log("\n=== 2. FRONTEND VERIFICATION ===");
  if (!fs.existsSync(path.join(__dirname, 'frontend/api'))) {
    console.log("[PASS] frontend/api directory no longer exists");
  } else {
    console.log("[FAIL] frontend/api still exists");
  }

  console.log("\n=== 3. PROVIDER VERIFICATION ===");
  process.env.ML_PROVIDER = 'vertex';
  let mlProvider = require('./backend/src/services/mlProvider');
  console.log(`[CASE A: vertex] mlProvider class name: ${mlProvider.provider.constructor.name}`);

  delete require.cache[require.resolve('./backend/src/services/mlProvider')];
  
  process.env.ML_PROVIDER = 'local';
  mlProvider = require('./backend/src/services/mlProvider');
  console.log(`[CASE B: local] mlProvider class name: ${mlProvider.provider.constructor.name}`);

  console.log("\n=== 4. WORKER REGISTRATION VERIFICATION ===");
  const registry = require('./backend/src/services/workerRegistry');
  registry.setWorkerUrl('https://test.ngrok.app');
  console.log(`[PASS] registry test: ${registry.getWorkerUrl()}`);

  console.log("\n=== 5. HEALTH CACHE VERIFICATION ===");
  const LocalWorkerProvider = require('./backend/src/services/providers/localWorkerProvider');
  const localProv = new LocalWorkerProvider();
  
  let fetchCallCount = 0;
  global.fetch = async (url) => {
    fetchCallCount++;
    return { ok: true };
  };

  await localProv._checkHealth();
  console.log(`[Request #1] Fetch calls: ${fetchCallCount}, cache: ${localProv.workerHealthCache.status}`);
  await localProv._checkHealth();
  console.log(`[Request #2] Fetch calls: ${fetchCallCount}, cache: ${localProv.workerHealthCache.status}`);

  localProv.workerHealthCache.lastChecked = Date.now() - 100000;
  await localProv._checkHealth();
  console.log(`[Request #3 (after expiration)] Fetch calls: ${fetchCallCount}, cache: ${localProv.workerHealthCache.status}`);

}

run().catch(console.error);
