const { sql } = require('@vercel/postgres');

async function connectDB() {
  if (!process.env.POSTGRES_URL) {
    console.error(JSON.stringify({
      service: 'audium-db',
      level: 'FATAL',
      message: 'POSTGRES_URL is not set. Exiting.'
    }));
    process.exit(1);
  }
  try {
    await sql`SELECT 1`;
    console.log(JSON.stringify({
      service: 'audium-db',
      level: 'INFO',
      message: 'Audium Postgres connected.'
    }));
  } catch (err) {
    console.error(JSON.stringify({
      service: 'audium-db',
      level: 'FATAL',
      message: err.message
    }));
    // Removed process.exit(1) to prevent serverless function crashes
  }
}

module.exports = { connectDB, sql };
