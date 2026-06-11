import db from '../db.js';

export async function createInvite(email, token, expiresAt) {
  const result = await db.query(
    'INSERT INTO invite_tokens (email, token, expires_at, used, created_at) VALUES ($1, $2, $3, false, now()) RETURNING *',
    [email, token, expiresAt]
  );
  return result.rows[0];
}

export async function findInviteByToken(token) {
  const result = await db.query('SELECT * FROM invite_tokens WHERE token = $1 LIMIT 1', [token]);
  return result.rows[0];
}

export async function markInviteUsed(id) {
  const result = await db.query('UPDATE invite_tokens SET used = true WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

export async function deleteInvite(id) {
  await db.query('DELETE FROM invite_tokens WHERE id = $1', [id]);
}
