import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import {
  usePostgresAuthState,
  clearPostgresAuthState,
} from "./baileysAuthPostgres.js";
import { normalizeWhatsAppRecipientForMeta } from "./metaWhatsapp.js";
import { handleInboundMetaWhatsAppPayload } from "./whatsappBotMeta.js";
import { logWhatsappMensajeRecibido } from "./whatsappNotificacionesLog.js";

const SESSION_ID = String(process.env.BAILEYS_SESSION_ID || "default").trim();

let sock = null;
let connectionStatus = "disconnected"; // disconnected | connecting | qr_ready | connected
let lastQrRaw = null;
let lastQrDataUrl = null;
let lastError = null;
let startingPromise = null;
let reconnectTimer = null;

function extractMessageText(msg) {
  const m = msg?.message;
  if (!m) return "";
  if (typeof m.conversation === "string") return m.conversation;
  if (typeof m.extendedTextMessage?.text === "string")
    return m.extendedTextMessage.text;
  if (typeof m.imageMessage?.caption === "string")
    return m.imageMessage.caption;
  if (typeof m.videoMessage?.caption === "string")
    return m.videoMessage.caption;
  if (typeof m.buttonsResponseMessage?.selectedDisplayText === "string")
    return m.buttonsResponseMessage.selectedDisplayText;
  if (typeof m.listResponseMessage?.title === "string")
    return m.listResponseMessage.title;
  return "";
}

function buildMetaShapedPayload(waId, text, pushName, messageId) {
  const phoneNumberId =
    String(process.env.WHATSAPP_PHONE_NUMBER_ID || "baileys-bot").trim() ||
    "baileys-bot";
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "baileys",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: phoneNumberId,
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: pushName || waId },
                  wa_id: waId,
                },
              ],
              messages: [
                {
                  from: waId,
                  id: messageId || `baileys-${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: text },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export async function startBaileys() {
  if (startingPromise) return startingPromise;
  startingPromise = (async () => {
    try {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connectionStatus = "connecting";
      lastError = null;

      const { state, saveCreds } = await usePostgresAuthState(SESSION_ID);
      const { version } = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["GestorNova", "Chrome", "120.0.0"],
        syncFullHistory: false,
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          lastQrRaw = qr;
          connectionStatus = "qr_ready";
          try {
            lastQrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          } catch (e) {
            console.error("[baileys] QR error:", e.message);
          }
          console.log(
            "[baileys] Nuevo QR generado. Abrí /api/webhooks/whatsapp/baileys/qr para escanearlo."
          );
        }

        if (connection === "open") {
          connectionStatus = "connected";
          lastQrRaw = null;
          lastQrDataUrl = null;
          lastError = null;
          console.log("[baileys] Conectado a WhatsApp correctamente.");
        }

        if (connection === "close") {
          const statusCode =
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.error?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          lastError = lastDisconnect?.error?.message || `closed_${statusCode || "unknown"}`;
          connectionStatus = "disconnected";
          sock = null;

          console.warn("[baileys] Conexión cerrada:", lastError);

          if (isLoggedOut) {
            console.warn("[baileys] Sesión cerrada (loggedOut). Limpiando credenciales en DB...");
            await clearPostgresAuthState(SESSION_ID);
          }

          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              startBaileys().catch((e) =>
                console.error("[baileys] Error al reconectar:", e.message)
              );
            }, 4000);
          }
        }
      });

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages || []) {
          try {
            if (!msg || msg.key?.fromMe) continue;
            const remoteJid = String(msg.key?.remoteJid || "");
            if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
              continue;
            }
            const waId = remoteJid.split("@")[0].replace(/\D/g, "");
            const text = extractMessageText(msg).trim();
            if (!waId || !text) continue;

            try {
              await logWhatsappMensajeRecibido(waId, text);
            } catch (e) {
              console.error("[baileys] log recibido DB:", e.message);
            }

            const payload = buildMetaShapedPayload(
              waId,
              text,
              msg.pushName || "",
              msg.key?.id
            );
            await handleInboundMetaWhatsAppPayload(payload);
          } catch (e) {
            console.error("[baileys] Error procesando mensaje entrante:", e);
          }
        }
      });
    } catch (e) {
      connectionStatus = "disconnected";
      lastError = e?.message || String(e);
      console.error("[baileys] Error iniciando:", lastError);
    } finally {
      startingPromise = null;
    }
  })();

  return startingPromise;
}

export function initBaileysIfConfigured() {
  const provider = String(process.env.WHATSAPP_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (provider === "baileys") {
    console.log("[baileys] WHATSAPP_PROVIDER=baileys detectado — iniciando conexión...");
    startBaileys().catch((e) =>
      console.error("[baileys] init error:", e.message)
    );
  }
}

export function getBaileysStatus() {
  return {
    status: connectionStatus,
    hasQr: Boolean(lastQrDataUrl),
    lastError,
    sessionId: SESSION_ID,
  };
}

export function getBaileysQrDataUrl() {
  return lastQrDataUrl;
}

export async function sendText(to, body) {
  if (!sock || connectionStatus !== "connected") {
    return {
      ok: false,
      error: `baileys_not_connected (${connectionStatus})`,
    };
  }
  const normalized = normalizeWhatsAppRecipientForMeta(to);
  if (!normalized) {
    return { ok: false, error: "invalid_recipient" };
  }
  const jid = `${normalized}@s.whatsapp.net`;
  try {
    const res = await sock.sendMessage(jid, { text: String(body || "") });
    return { ok: true, data: res };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
