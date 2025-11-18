// index.js – FINAL FIXED VERSION (race condition + reconnect + QR API)
// Requires Node.js >= 16

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

// FIX: sock harus "let" agar bisa di-reassign saat reconnect
let sock = null;

const QR_FILE = path.join(os.tmpdir(), "last_qr.txt");
const AUTH_FOLDER = "./auth_info";

// Control flags untuk mencegah double start
let startPromise = null;
let reconnectTimer = null;
let connected = false;
let lastStartAttempt = 0;

/* ===========================
      QR API WEB SERVER
=========================== */

const server = http.createServer(async (req, res) => {
    if (req.url === "/api/qr") {
        try {
            const qrContent = await fs.promises.readFile(QR_FILE, "utf-8");
            const qrDataUrl = await QRCode.toDataURL(qrContent);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ qr: qrDataUrl }));
        } catch (_) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ qr: null }));
        }
    }

    // Serve static UI
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
    console.log("Server running at http://160.25.222.84:3000/");
});

/* ===========================
        CHAT HISTORY
=========================== */

async function saveChatHistory(sender, message, isBot = false) {
    const dir = path.join(__dirname, "chat_history");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, `${sender.split("@")[0]}.log`);
    const ts = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    await fs.promises.appendFile(file, `[${ts}] ${isBot ? "Bot" : "User"}: ${message}\n`);
}

function isNewUser(sender) {
    return !fs.existsSync(path.join(__dirname, "chat_history", `${sender.split("@")[0]}.log`));
}

/* ===========================
       RESPON OTOMATIS
=========================== */

function getGreetingResponse(text, force = false) {
    const g = ["hi", "halo", "hai", "p", "permisi", "assalamualaikum", "selamat pagi", "selamat siang", "selamat sore", "selamat malam"];
    const n = text.toLowerCase().trim();

    const hour = new Date().getHours();
    const w = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam";
    const s = `Selamat ${w}`;

    if (g.includes(n))
        return `${s} juga! 😊 Ada yang bisa aku bantu?\n\nCoba tanyakan:\n- Paket WiFi\n- Cara bayar\n- Nomor teknisi\n`;

    return force ? s : null;
}

function getInfoResponse(text) {
    const t = text.toLowerCase();

    if (t.includes("alamat"))
        return `📍 Lokasi kantor:\nPT. Telemedia Prima Nusantara\nhttps://www.google.com/maps/place/PT.+Telemedia+Prima+Nusantara/`;

    if (t.includes("teknisi"))
        return `🔧 Hubungi teknisi: 0851-7205-1808`;

    return null;
}

/* ===========================
      SAVE MEDIA USER
=========================== */

async function saveMedia(msg, sock, sender) {
    if (!msg.message) return;

    const type = Object.keys(msg.message).find(x =>
        ["imageMessage", "videoMessage", "documentMessage", "audioMessage", "locationMessage"].includes(x)
    );

    if (!type) return;

    const folder = path.join(__dirname, "media", sender.replace(/[@:\.]/g, "_"));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    if (type === "locationMessage") {
        const f = path.join(folder, `location_${Date.now()}.json`);
        fs.writeFileSync(f, JSON.stringify({
            lat: msg.message[type].degreesLatitude,
            lng: msg.message[type].degreesLongitude
        }, null, 2));
        return;
    }

    const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger: P({ level: "silent" }) });

    const ext = type === "imageMessage" ? ".jpg"
        : type === "videoMessage" ? ".mp4"
            : type === "audioMessage" ? ".mp3"
                : "";

    const f = path.join(folder, Date.now() + ext);
    fs.writeFileSync(f, buffer);
}

/* ===========================
        START SOCKET SAFE
=========================== */

async function startSock() {
    if (startPromise) return startPromise;

    startPromise = (async () => {

        if (Date.now() - lastStartAttempt < 1500)
            await new Promise(r => setTimeout(r, 1500));
        lastStartAttempt = Date.now();

        if (connected) {
            startPromise = null;
            return;
        }

        console.log("Starting WhatsApp socket...");

        try {
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
            const { version } = await fetchLatestBaileysVersion();

            sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
                },
                printQRInTerminal: false,
                logger: P({ level: "silent" }),
            });

            sock.ev.on("creds.update", saveCreds);

            /* ======================= MESSAGE RECEIVED ======================= */

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
                    const welcome = `Selamat datang di layanan WiFi! 👋 Saya siap membantu.`;
                    await sock.sendMessage(sender, { text: welcome });
                    await saveChatHistory(sender, welcome, true);
                }

                const greet = getGreetingResponse(text);
                if (greet && !newUser) {
                    await sock.sendMessage(sender, { text: greet });
                    return;
                }

                const info = getInfoResponse(text);
                if (info) {
                    await sock.sendMessage(sender, { text: info });
                    return;
                }

                try {
                    const res = await axios.post("http://160.25.222.84:8001/chat", { query: text });
                    const answer = res.data.response || "Maaf, saya tidak memahami pertanyaan Anda.";
                    await sock.sendMessage(sender, { text: answer });
                    await saveChatHistory(sender, answer, true);
                } catch (e) {
                    await sock.sendMessage(sender, { text: "Terjadi error, coba lagi nanti." });
                }
            });

            /* ======================= CONNECTION UPDATE ====================== */

            sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
                if (qr) fs.writeFileSync(QR_FILE, qr);

                if (connection === "open") {
                    console.log("WhatsApp connected!");
                    connected = true;
                    if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE);
                }

                if (connection === "close") {
                    connected = false;

                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    console.log("Connection closed:", reason);

                    if (reason === DisconnectReason.loggedOut) {
                        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                        return;
                    }

                    if (!reconnectTimer) {
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            startSock();
                        }, 5000);
                    }
                }
            });

        } catch (err) {
            console.error("startSock error:", err);
        } finally {
            startPromise = null;
        }
    })();

    return startPromise;
}

/* ===========================
       START ON RUN
=========================== */

process.on("SIGINT", () => process.exit(0));
startSock();
