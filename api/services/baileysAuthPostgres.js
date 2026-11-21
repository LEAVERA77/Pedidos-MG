import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import { query } from "../db/neon.js";

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS baileys_auth_state (
      session_id TEXT NOT NULL,
      key_id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (session_id, key_id)
    )
  `);
  tableEnsured = true;
}

async function readData(sessionId, keyId) {
  await ensureTable();
  const res = await query(
    "SELECT data_json FROM baileys_auth_state WHERE session_id = $1 AND key_id = $2 LIMIT 1",
    [sessionId, keyId]
  );
  if (!res.rows || res.rows.length === 0) return null;
  try {
    return JSON.parse(res.rows[0].data_json, BufferJSON.reviver);
  } catch {
    return null;
  }
}

async function writeData(sessionId, keyId, data) {
  await ensureTable();
  const serialized = JSON.stringify(data, BufferJSON.replacer);
  await query(
    `INSERT INTO baileys_auth_state (session_id, key_id, data_json, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (session_id, key_id)
     DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = NOW()`,
    [sessionId, keyId, serialized]
  );
}

async function removeData(sessionId, keyId) {
  await ensureTable();
  await query(
    "DELETE FROM baileys_auth_state WHERE session_id = $1 AND key_id = $2",
    [sessionId, keyId]
  );
}

export async function clearPostgresAuthState(sessionId = "default") {
  await ensureTable();
  await query("DELETE FROM baileys_auth_state WHERE session_id = $1", [sessionId]);
}

export async function usePostgresAuthState(sessionId = "default") {
  const creds = (await readData(sessionId, "creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(sessionId, `${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(sessionId, key, value));
              } else {
                tasks.push(removeData(sessionId, key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(sessionId, "creds", creds);
    },
  };
}
