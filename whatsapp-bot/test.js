const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const P = require('pino');
const { spawn } = require('child_process');
const path = require('path');


function getGreetingResponse(text) {
    const greetings = ['hi', 'halo', 'hai', 'assalamualaikum', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam', 'misi', 'permisi'];
    const normalized = text?.toLowerCase()?.trim();

    if (!normalized) return null;

    for (const greet of greetings) {
        if (normalized.includes(greet)) {
            const hour = new Date().getHours();
            let waktu = 'malam';
            if (hour >= 5 && hour < 11) waktu = 'pagi';
            else if (hour >= 11 && hour < 15) waktu = 'siang';
            else if (hour >= 15 && hour < 18) waktu = 'sore';

            return `Selamat ${waktu} juga! 😊 Ada yang bisa aku bantu? Kamu bisa tanya misalnya:\n- Paket WiFi yang tersedia\n- Cara pembayaran\n- Hubungi teknisi\n\nSilakan tanyakan ya~`;
        }
    }
    return null;
}

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        if (isGroup) return; // ❌ Abaikan pesan dari grup

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        console.log(`📩 Pesan diterima dari ${sender}: ${text}`);

        // Balas sapaan jika hanya menyapa
        const greetingReply = getGreetingResponse(text);
        if (greetingReply) {
            await sock.sendMessage(sender, { text: greetingReply });
            return;
        }

        // Jalankan chatbot Python jika bukan sapaan
        const python = spawn('python3', ['../run_chatbot.py', text]);

        let output = '';
        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            console.error(`❌ Error dari Python: ${data}`);
        });

        python.on('close', () => {
            const friendlyOutput = output.trim()
                .replace(/^/gm, '👉 ') // buat lebih ramah
                .concat('\n\nKalau ada pertanyaan lain, tinggal chat aja ya 😊');
            sock.sendMessage(sender, { text: friendlyOutput });
        });
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Reconnect?', shouldReconnect);
            if (shouldReconnect) {
                startSock();
            }
        } else if (connection === 'open') {
            console.log('✅ Terhubung ke WhatsApp!');
        }
    });
}

startSock();
