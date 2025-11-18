/******************************************************************
 *  WHATSAPP BOT — AGGRESSIVE, RACE-SAFE, PROCESS-LOCKED VERSION  *
 ******************************************************************/

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

/* =============================================================
    PROCESS-LEVEL LOCK — PREVENT MULTIPLE NODE INSTANCES
   ============================================================= */

const LOCK_FILE = path.join(__dirname, "process.lock");

if (fs.existsSync(LOCK_FILE)) {
    console.error("❌ Another instance already running. Exiting...");
    process.exit(1);
}
fs.writeFileSync(LOCK_FILE, process.pid.toString());

process.on("exit", () => fs.existsSync(LOCK_FILE) && fs.unlinkSync(LOCK_FILE));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

/* =============================================================
   GLOBAL STATE + FLAGS
   ============================================================= */

let sock = null;
let startPromise = null;
let reconnectTimer = null;
let connected = false;

let retryDelay = 5000; // exponential backoff
let lastStart = 0;

const QR_FILE = path.join(os.tmpdir(), "last_qr.txt");
const AUTH_FOLDER = "./auth_info";

/* =============================================================
    QR WEB SERVER (Tetap memakai template kamu)
   ============================================================= */

const server = http.createServer(async (req, res) => {
    if (req.url === "/api/qr") {
        try {
            const qrText = await fs.promises.readFile(QR_FILE, "utf-8");
            const qrImg = await QRCode.toDataURL(qrText);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ qr: qrImg }));
        } catch (_) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ qr: null }));
        }
    }

    const filePath = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
    const ext = path.extname(filePath).toLowerCase();
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "text/plain";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("Not Found");
        }
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log("🌐 Server running at http://YOUR-IP:3000/");
});

/* =============================================================
    BASIC HELPER: CHAT, MEDIA, AUTO REPLY (mengikuti template kamu)
   ============================================================= */

// (Bagian saveChatHistory, isNewUser, getGreetingResponse, getInfoResponse,
//  saveMedia tetap sama, tidak diubah karena kamu ingin mempertahankan struktur)

/* =============================================================
    START SOCKET — AGGRESSIVE & RACE-SAFE
   ============================================================= */

async function startSock() {
    if (startPromise) return startPromise;

    startPromise = (async () => {
        const now = Date.now();
        if (now - lastStart < 2000) {
            await new Promise(r => setTimeout(r, 1500));
        }
        lastStart = now;

        if (connected) {
            startPromise = null;
            return;
        }

        try {
            console.log("⚡ Starting WhatsApp socket...");

            const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
            const { version } = await fetchLatestBaileysVersion();

            sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
                },
                printQRInTerminal: false,
                logger: P({ level: "silent" })
            });

            sock.ev.on("creds.update", saveCreds);

            /* ==================== PESAN MASUK ==================== */

            sock.ev.on("messages.upsert", async ({ messages }) => {
                const msg = messages[0];
                if (!msg || msg.key.fromMe) return;

                const sender = msg.key.remoteJid;

                if (sender.endsWith("@g.us")) return;

                const text = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text || "";

                await saveMedia(msg, sock, sender);
                await saveChatHistory(sender, text);

                const newUser = isNewUser(sender);
                if (newUser) {
                    const welcome = `Selamat datang di layanan WiFi! 👋`;
                    await sock.sendMessage(sender, { text: welcome });
                    await saveChatHistory(sender, welcome, true);
                }

                const greet = getGreetingResponse(text);
                if (greet && !newUser) return sock.sendMessage(sender, { text: greet });

                const info = getInfoResponse(text);
                if (info) return sock.sendMessage(sender, { text: info });

                try {
                    const res = await axios.post("http://YOUR-SERVER:8001/chat", { query: text });
                    const answer = res.data.response || "Maaf, saya tidak memahami pertanyaan Anda.";
                    await sock.sendMessage(sender, { text: answer });
                    await saveChatHistory(sender, answer, true);
                } catch {
                    await sock.sendMessage(sender, { text: "Error dari server, coba lagi." });
                }
            });

            /* ==================== HANDLE CONNECTION ==================== */

            sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {

                if (qr) fs.writeFileSync(QR_FILE, qr);

                if (connection === "open") {
                    console.log("✅ WhatsApp Connected!");
                    connected = true;
                    retryDelay = 5000;
                    if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE);
                }

                if (connection === "close") {
                    connected = false;

                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    console.log("❌ Disconnected:", reason);

                    /* ==================== LOGIKA BARU AGRESIF ==================== */

                    if (reason === 401) {
                        console.log("🟥 401 Unauthorized → Hapus auth & relogin");
                        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                        return startSock();
                    }

                    if (reason === 515) {
                        console.log("🟧 515 Stream Error → Soft reset");
                        return softReconnect();
                    }

                    if (reason === DisconnectReason.loggedOut) {
                        console.log("🟥 Logged out → Reset total");
                        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                        return startSock();
                    }

                    scheduleReconnect();
                }
            });

        } catch (err) {
            console.error("❌ startSock ERROR:", err);
            scheduleReconnect();
        } finally {
            startPromise = null;
        }
    })();

    return startPromise;
}

/* =============================================================
    RECONNECT HANDLER — AGGRESSIVE & BACKOFF
   ============================================================= */

function softReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        console.log("🔄 Soft reconnect...");
        startSock();
    }, 4000);
}

function scheduleReconnect() {
    if (reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        retryDelay = Math.min(retryDelay * 2, 30000);
        console.log(`🔁 Reconnecting in ${retryDelay / 1000}s...`);
        startSock();
    }, retryDelay);
}

/* =============================================================
    RUN BOT
   ============================================================= */

startSock();
