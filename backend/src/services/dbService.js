const { sql } = require('../config/db');

async function createUser({ email, hashedPassword }) {
  const { rows } = await sql`
    INSERT INTO audium_users (email, password)
    VALUES (${email}, ${hashedPassword})
    RETURNING id as "_id", email, created_at
  `;
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await sql`
    SELECT id as "_id", password, email, created_at FROM audium_users WHERE email = ${email} LIMIT 1
  `;
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await sql`
    SELECT id as "_id", email, created_at FROM audium_users WHERE id = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

async function createSession({ userId, refreshToken, deviceInfo = 'unknown', ipAddress = 'unknown', expiresAt }) {
  const { rows } = await sql`
    INSERT INTO audium_sessions (user_id, refresh_token, device_info, ip_address, expires_at)
    VALUES (${userId}, ${refreshToken}, ${deviceInfo}, ${ipAddress}, ${expiresAt})
    RETURNING id as "_id", user_id as "userId", refresh_token as "refreshToken", device_info as "deviceInfo", ip_address as "ipAddress", expires_at as "expiresAt", is_revoked as "isRevoked", created_at as "createdAt"
  `;
  return rows[0];
}

async function findSessionByToken(refreshToken) {
  const { rows } = await sql`
    SELECT id as "_id", user_id as "userId", refresh_token as "refreshToken", device_info as "deviceInfo", ip_address as "ipAddress", expires_at as "expiresAt", is_revoked as "isRevoked", created_at as "createdAt"
    FROM audium_sessions
    WHERE refresh_token = ${refreshToken}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function updateSessionRevoked(refreshToken, isRevoked) {
  const { rows } = await sql`
    UPDATE audium_sessions
    SET is_revoked = ${isRevoked}
    WHERE refresh_token = ${refreshToken}
    RETURNING id as "_id", user_id as "userId", refresh_token as "refreshToken", device_info as "deviceInfo", ip_address as "ipAddress", expires_at as "expiresAt", is_revoked as "isRevoked", created_at as "createdAt"
  `;
  return rows[0] || null;
}

async function deleteSessionByToken(refreshToken) {
  await sql`DELETE FROM audium_sessions WHERE refresh_token = ${refreshToken}`;
}

async function deleteAllUserSessions(userId) {
  await sql`DELETE FROM audium_sessions WHERE user_id = ${userId}`;
}

async function createVoice({ userId, voiceId, uploadId, jobId = null, isReady = false }) {
  const { rows } = await sql`
    INSERT INTO audium_voices (user_id, voice_id, upload_id, job_id, is_ready)
    VALUES (${userId}, ${voiceId}, ${uploadId}, ${jobId}, ${isReady})
    RETURNING id as "_id", user_id as "userId", voice_id as "voiceId", upload_id as "uploadId", job_id as "jobId", is_ready as "isReady", created_at as "createdAt"
  `;
  return rows[0];
}

async function findVoiceByVoiceId(voiceId) {
  const { rows } = await sql`
    SELECT id as "_id", user_id as "userId", voice_id as "voiceId", upload_id as "uploadId", job_id as "jobId", is_ready as "isReady", created_at as "createdAt"
    FROM audium_voices WHERE voice_id = ${voiceId} LIMIT 1
  `;
  return rows[0] || null;
}

async function findVoiceByVoiceIdAndUserId(voiceId, userId) {
  const { rows } = await sql`
    SELECT id as "_id", user_id as "userId", voice_id as "voiceId", upload_id as "uploadId", job_id as "jobId", is_ready as "isReady", created_at as "createdAt"
    FROM audium_voices WHERE voice_id = ${voiceId} AND user_id = ${userId} LIMIT 1
  `;
  return rows[0] || null;
}

async function updateVoiceReadinessByJobId(jobId, isReady) {
  const { rows } = await sql`
    UPDATE audium_voices
    SET is_ready = ${isReady}
    WHERE job_id = ${jobId}
    RETURNING id as "_id", user_id as "userId", voice_id as "voiceId", upload_id as "uploadId", job_id as "jobId", is_ready as "isReady", created_at as "createdAt"
  `;
  return rows[0] || null;
}

async function updateVoiceReadinessByVoiceId(voiceId, isReady) {
  const { rows } = await sql`
    UPDATE audium_voices
    SET is_ready = ${isReady}
    WHERE voice_id = ${voiceId}
    RETURNING id as "_id", user_id as "userId", voice_id as "voiceId", upload_id as "uploadId", job_id as "jobId", is_ready as "isReady", created_at as "createdAt"
  `;
  return rows[0] || null;
}

async function getVoicesByUser(userId) {
  const { rows } = await sql`
    SELECT id as "_id", user_id as "userId", voice_id as "voiceId", upload_id as "uploadId", job_id as "jobId", is_ready as "isReady", created_at as "createdAt"
    FROM audium_voices
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows;
}

async function createGeneration({ userId, voiceId, text, audioBlobUrl = '' }) {
  const { rows } = await sql`
    INSERT INTO audium_generations (user_id, voice_id, text, audio_blob_url)
    VALUES (${userId}, ${voiceId}, ${text}, ${audioBlobUrl})
    RETURNING id as "_id", user_id as "userId", voice_id as "voiceId", text, audio_blob_url as "audioBlobUrl", created_at as "createdAt"
  `;
  return rows[0];
}

async function updateGenerationAudioUrl(id, audioBlobUrl) {
  const { rows } = await sql`
    UPDATE audium_generations
    SET audio_blob_url = ${audioBlobUrl}
    WHERE id = ${id}
    RETURNING id as "_id", user_id as "userId", voice_id as "voiceId", text, audio_blob_url as "audioBlobUrl", created_at as "createdAt"
  `;
  return rows[0] || null;
}

async function getGenerationsByUser(userId, page, limit) {
  const offset = (page - 1) * limit;
  const { rows } = await sql`
    SELECT id as "_id", user_id as "userId", voice_id as "voiceId", text, audio_blob_url as "audioBlobUrl", created_at as "createdAt"
    FROM audium_generations
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const { rows: countRows } = await sql`
    SELECT COUNT(*) FROM audium_generations WHERE user_id = ${userId}
  `;
  return { records: rows, total: parseInt(countRows[0].count) };
}

async function getLatestGeneration() {
  const { rows } = await sql`
    SELECT id as "_id", user_id as "userId", voice_id as "voiceId", text, audio_blob_url as "audioBlobUrl", created_at as "createdAt"
    FROM audium_generations
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] || null;
}

async function deleteGeneration(id, userId) {
  const { rowCount } = await sql`
    DELETE FROM audium_generations
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return rowCount;
}

module.exports = {
  createUser, findUserByEmail, findUserById,
  createSession, findSessionByToken, updateSessionRevoked, deleteSessionByToken, deleteAllUserSessions,
  createVoice, findVoiceByVoiceId, findVoiceByVoiceIdAndUserId, updateVoiceReadinessByJobId, updateVoiceReadinessByVoiceId, getVoicesByUser,
  createGeneration, updateGenerationAudioUrl, getGenerationsByUser, getLatestGeneration, deleteGeneration
};
