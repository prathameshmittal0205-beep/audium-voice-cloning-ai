const { sql } = require('@vercel/postgres');

async function setWorkerUrl(url) {
  if (!url) return;
  await sql`
    INSERT INTO audium_config (key, value, updated_at)
    VALUES ('worker_url', ${url}, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = ${url}, updated_at = NOW()
  `;
}

async function getWorkerUrl() {
  // Check process.env first for local development, otherwise fallback to DB
  if (process.env.LOCAL_WORKER_URL) {
    return process.env.LOCAL_WORKER_URL;
  }
  
  try {
    const result = await sql`
      SELECT value FROM audium_config WHERE key = 'worker_url'
    `;
    return result.rows[0]?.value || null;
  } catch (error) {
    console.error('Failed to get worker URL from DB:', error);
    return null;
  }
}

module.exports = { setWorkerUrl, getWorkerUrl };
