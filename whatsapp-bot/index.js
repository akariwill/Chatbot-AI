// index.js — STRONGER VERSION
// - process lock to prevent double-node start
// - exponential backoff, special-handling for 401/515
// - robust cleanup of previous socket
// Node >= 16 recommended

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");
const P = require("pino");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const http = require("http");
const QRCode = require("qrcode");
const os = require("os");
const util = require("util");

// ----------------- CONFIG -----------------
const QR_FILE = path.join(os.tmpdir(), "last_qr.txt");
const AUTH_FOLDER = path.join(__dirname, "auth_info");
const LOCK_FILE = "/tmp/whatsapp-bot.lock";
const SERVER_PORT = 3000;
const CHATBOT_API = process.env.CHATBOT_API_URL || "http://127.0.0.1:8001/chat";

// ----------------- PROCESS-LEVEL LOCK -----------------
// Prevent accidental double-start (if lock exists, exit)
try {
  const fd = fs.openSync(LOCK_FILE, "wx"); // throws if exists
  fs.writeSync(fd, `${process.pid}`);
  // Keep fd open so lock file remains; we'll remove on exit
  process.on("exit", () => {
    try { fs.unlinkSync(LOCK_FILE); } catch (e) {}
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
} catch (e) {
  console.error(`[LOCK] Another instance is running or lock file exists (${LOCK_FILE}). Exiting.`);
  process.exit(1);
}

// ----------------- GLOBALS -----------------
let sock = null;
let connected = false;
let isStarting = false;
let reconnectTimer = null;
let failCount = 0; // number of consecutive failed attempts (for backoff)

// compute backoff delay in ms
function backoffDelay(failCount, base = 3000, cap = 60000) {
  const delay = Math.min(cap, Math.round(base * Math.pow(1.8, Math.max(0, failCount - 1))));
  return delay;
}

// ----------------- SIMPLE QR WEB API -----------------
const server = http.createServer(async (req, res) => {
  if (req.url === "/api/qr") {
    try {
      const qr = (await fs.promises.readFile(QR_FILE, "utf-8")).trim();
      if (!qr) throw new Error("empty");
      const dataUrl = await QRCode.toDataURL(qr);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ qr: dataUrl }));
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ qr: null, msg: "QR not available" }));
    }
  }

  // serve minimal index if needed
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<html><body><h3>WhatsApp Bot</h3><p>Visit /api/qr to get QR (data-url)</p></body></html>`);
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(SERVER_PORT, () => {
  console.log(`[HTTP] QR server running on http://0.0.0.0:${SERVER_PORT}/`);
});

// ----------------- UTILITIES -----------------
async function safeUnlink(file) {
  try { if (fs.existsSync(file)) await fs.promises.unlink(file); } catch (e) {}
}

function clearSock() {
  if (!sock) return;
  try {
    sock.ev.removeAllListeners();
  } catch (e) {}
  try {
    sock.end && sock.end();
  } catch (e) {}
  sock = null;
}

// minimal chat logging for debugging
async function appendLog(sender, text, isBot = false) {
  try {
    const dir = path.join(__dirname, "chat_history");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${sender.split("@")[0]}.log`);
    const ts = new Date().toLocaleString();
    await fs.promises.appendFile(file, `[${ts}] ${isBot ? "Bot" : "User"}: ${text}\n`);
  } catch (e) {
    console.warn("[LOG] appendLog failed", e.message || e);
  }
}

async function saveMedia(msg, sockInstance, sender) {
  try {
    if (!msg.message) return;
    const type = Object.keys(msg.message).find(k =>
      ["imageMessage", "videoMessage", "documentMessage", "audioMessage", "locationMessage"].includes(k)
    );
    if (!type) return;
    const folder = path.join(__dirname, "media", sender.replace(/[@:\.]/g, "_"));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    if (type === "locationMessage") {
      const file = path.join(folder, `location_${Date.now()}.json`);
      fs.writeFileSync(file, JSON.stringify(msg.message[type], null, 2));
      return;
    }

    const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: P({ level: "silent" }) });
    const ext = type === "imageMessage" ? ".jpg" : type === "videoMessage" ? ".mp4" : ".bin";
    const filePath = path.join(folder, `${Date.now()}${ext}`);
    fs.writeFileSync(filePath, buffer);
  } catch (e) {
    console.warn("[MEDIA] saveMedia failed", e.message || e);
  }
}

// ----------------- START SOCKET (robust) -----------------
async function startSock() {
  // prevent concurrent starts
  if (isStarting) {
    console.log("[startSock] already starting, skip.");
    return;
  }
  if (connected) {
    console.log("[startSock] already connected, skip.");
    return;
  }

  isStarting = true;
  try {
    console.log("[startSock] attempt starting...");

    // cleanup old socket state
    clearSock();

    // ensure auth folder exists (Baileys will create it if not)
    if (!fs.existsSync(AUTH_FOLDER)) {
      try { fs.mkdirSync(AUTH_FOLDER, { recursive: true }); } catch (e) {}
    }

    // fetch version
    let version;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
      console.log("[startSock] baileys version:", version);
    } catch (e) {
      console.warn("[startSock] failed to fetch baileys version, continuing with default. Err:", e.message || e);
      version = undefined;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    sock = makeWASocket({
      version,
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
      },
      connectTimeoutMs: 60000,
      syncFullHistory: false
    });

    // save creds on change
    sock.ev.on("creds.update", saveCreds);

    // messages event
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages?.[0];
        if (!msg || msg.key?.fromMe) return;
        const sender = msg.key.remoteJid || "unknown";
        if (sender.endsWith("@g.us")) return;

        // save media & history
        await saveMedia(msg, sock, sender);

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        if (text) {
          await appendLog(sender, text, false);
        }

        // auto replies (simple)
        const t = text.toLowerCase().trim();
        if (!t) return;

        if (["hi","halo","hai","p"].includes(t)) {
          const hour = new Date().getHours();
          const w = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam";
          const reply = `Selamat ${w}! Ada yang bisa dibantu?`;
          await sock.sendMessage(sender, { text: reply });
          await appendLog(sender, reply, true);
          return;
        }

        // forward to python chatbot API
        try {
          const resp = await axios.post(CHATBOT_API, { query: text }, { timeout: 20000 });
          const out = (resp.data?.response || "Maaf, saya belum tahu jawaban itu.").toString();
          await sock.sendMessage(sender, { text: out });
          await appendLog(sender, out, true);
        } catch (e) {
          console.warn("[CHAT] chatbot request failed", e.message || e);
          await sock.sendMessage(sender, { text: "Maaf, terjadi gangguan sistem. Coba lagi nanti." });
        }
      } catch (inner) {
        console.error("[MSG HANDLER] error", inner);
      }
    });

    // connection update
    sock.ev.on("connection.update", async (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try { await fs.promises.writeFile(QR_FILE, qr); } catch (e) {}
          console.log("[QR] QR updated (written to file)");
        }

        if (connection === "open") {
          console.log("[CONN] connection open");
          connected = true;
          failCount = 0; // reset failure counter on success
          // remove QR file to hide
          try { await safeUnlink(QR_FILE); } catch (e) {}
        }

        if (connection === "close") {
          connected = false;
          const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
          console.warn("[CONN] connection closed:", code, util.inspect(lastDisconnect?.error, { depth: 1 }));

          // handle specific codes
          if (code === DisconnectReason.loggedOut || code === 401) {
            // 401 typically means session conflict — do NOT auto-restart aggressively.
            console.error("[CONN] logged out/conflict detected (401).");
            console.error("[CONN] Action: remove auth folder and re-scan QR manually.");
            try { fs.rmSync(AUTH_FOLDER, { force: true, recursive: true }); } catch (e) { console.warn("[CLEAN] failed remove auth", e.message || e); }
            // allow user to scan again: write no QR (will be recreated on next start)
            await safeUnlink(QR_FILE);
            // leave process running but DO NOT auto-restart. Exit to allow manual start/scan if desired.
            console.error("[CONN] Exiting process to allow clean re-login. Start the script again after scanning QR.");
            // cleanup then exit
            clearSock();
            process.exit(0);
            return;
          }

          if (code === 515) {
            // stream errored — increase failure count and schedule a longer backoff
            failCount++;
            const delay = backoffDelay(failCount, 5000, 120000); // base 5s, cap 120s for stream errors
            console.warn(`[CONN] stream error (515). Scheduling reconnect in ${delay}ms (failCount=${failCount}).`);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              startSock().catch(e => console.error("[RECONNECT] startSock failed", e));
            }, delay);
            return;
          }

          // other closes: moderate backoff and restart
          failCount++;
          const delay = backoffDelay(failCount);
          console.log(`[CONN] scheduling reconnect in ${delay}ms (failCount=${failCount})`);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startSock().catch(e => console.error("[RECONNECT] startSock failed", e));
          }, delay);
        }
      } catch (e) {
        console.error("[CONN HANDLER] error", e);
      }
    });

    console.log("[startSock] socket created & handlers attached.");
  } catch (e) {
    // fatal startup error
    failCount++;
    const delay = backoffDelay(failCount);
    console.error("[startSock] fatal error while starting:", e?.message || e);
    console.log(`[startSock] retrying in ${delay} ms`);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startSock().catch(err => console.error("[RETRY] startSock failed", err));
    }, delay);
  } finally {
    isStarting = false;
  }
}

// ----------------- start on run -----------------
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT]", err);
});
process.on("unhandledRejection", (r) => {
  console.error("[UNHANDLED REJECTION]", r);
});

// graceful shutdown: clean sock and lock file
process.on("SIGINT", async () => {
  console.log("[SIGNAL] SIGINT received, shutting down.");
  if (reconnectTimer) clearTimeout(reconnectTimer);
  clearSock();
  try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch (e) {}
  process.exit(0);
});

// kick off
startSock().catch(e => {
  console.error("[BOOT] startSock initial failed", e);
});
