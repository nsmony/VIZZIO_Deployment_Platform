import pkg from 'pg';
const { Pool } = pkg;

// Shared PostgreSQL pool for code that uses raw SQL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/vizzio',
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export default pool;
