const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require("cors");
const http = require("http");
const qrcode = require("qrcode");

// === EXPRESS SERVER ===
const app = express();
app.use(cors());
app.use(express.json());

let GLOBAL_QR = "";
let sock;

// === START SOCKET ===
async function startSocket() {
    console.log("Starting WhatsApp socket...");

    const { state, saveCreds } = await useMultiFileAuthState("./auth");
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state
    });

    // ==== QR EVENT ====
    sock.ev.on("connection.update", async (update) => {
        const { connection, qr, lastDisconnect } = update;

        // Generate QR and save as Base64 PNG
        if (qr) {
            GLOBAL_QR = await qrcode.toDataURL(qr);
            console.log("QR Updated! Scan now.");
        }

        // Connection events
        if (connection === "open") {
            console.log("WhatsApp connected!");
            GLOBAL_QR = ""; // Clear QR after connect
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log("Connection closed:", reason);

            if (reason === DisconnectReason.loggedOut) {
                console.log("Logged out — deleting session...");
                const fs = require("fs");
                fs.rmSync("./auth", { recursive: true, force: true });
                return startSocket();
            }

            console.log("Reconnecting socket...");
            startSocket();
        }
    });

    // Save creds
    sock.ev.on("creds.update", saveCreds);

    // === CHAT HANDLER (TETAP DIPERTAHANKAN) ===
    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || "";

            console.log("Pesan dari:", from, "isi:", text);

            // === contoh balasan default ===
            await sock.sendMessage(from, { text: "Pesan diterima kak: " + text });
        } catch (e) {
            console.error("Chat handler error:", e);
        }
    });
}

// === QR API (GAMBAR PNG) ===
app.get("/api/qr", (req, res) => {
    if (!GLOBAL_QR) {
        return res.send(`
            <html>
                <body style="font-family:sans-serif">
                    <h2>QR belum tersedia atau sudah terhubung!</h2>
                </body>
            </html>
        `);
    }

    res.send(`
        <html>
            <body style="text-align:center;">
                <h2>Scan QR WhatsApp</h2>
                <img src="${GLOBAL_QR}" style="width:300px;" />
            </body>
        </html>
    `);
});

// === START SERVER ===
const server = http.createServer(app);
server.listen(3000, () =>
    console.log("Server running at http://160.25.222.84:3000/")
);

// Start WhatsApp
startSocket();
