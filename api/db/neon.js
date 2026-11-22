import pg from "pg";
import { normalizePgConnectionString } from "./pgSslUrl.js";

const { Pool } = pg;

const rawConnectionString = process.env.DB_CONNECTION || process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error("Falta DB_CONNECTION o DATABASE_URL en variables de entorno");
}

const connectionString = normalizePgConnectionString(rawConnectionString);
const needsSsl =
  connectionString.includes("neon.tech") ||
  /[?&]sslmode=(require|prefer|verify-ca|verify-full|no-verify)/i.test(connectionString);

export const pool = new Pool({
  connectionString,
  ...(needsSsl && !/[?&]sslmode=/i.test(connectionString)
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

export { normalizePgConnectionString };

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

