import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } from "@whiskeysockets/baileys";
import P from "pino";
import fs from "fs/promises";
import path from "path";

const QR_FILE = path.join(process.cwd(), '..', '..', 'last_qr.txt');

export default async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })) },
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            try {
                await fs.writeFile(QR_FILE, qr);
                console.log("QR code saved to file.");
            } catch (err) {
                console.error("Failed to write QR code to file:", err);
            }
        }

        if (connection === "close") {
            // If connection closed, the QR is no longer valid.
            try {
                await fs.unlink(QR_FILE);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error("Failed to delete QR file:", err);
                }
            }

            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === "open") {
            // Connection is open, QR is no longer needed.
            try {
                await fs.unlink(QR_FILE);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error("Failed to delete QR file:", err);
                }
            }
            console.log("✅ Terhubung ke WhatsApp!");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        try {
            const response = await fetch("http://160.25.222.84:3000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: text }),
            });
            const data = await response.json();
            const reply = data.response || "Maaf, saya tidak mengerti.";
            await sock.sendMessage(msg.key.remoteJid, { text: reply });
        } catch (err) {
            console.error(err);
        }
    });
}

startBot().catch(console.error);