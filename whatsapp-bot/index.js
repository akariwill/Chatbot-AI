// index.js (race-condition, error handling, and lockfile fixed v2)
// Requirements: Node >= 16/18 recommended

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const P = require('pino');
const axios = require('axios');
const fs = require('fs');
const util = require('util');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');
const os = require('os');
const lockfile = require('proper-lockfile');

const QR_FILE = path.join(os.tmpdir(), 'last_qr.txt');
const AUTH_FOLDER = './auth_info';
const LOCK_FILE = './whatsapp.lock';

let sock = null;
let reconnectTimer = null;
let isConnecting = false; // State guard to prevent connection race conditions

// --- Server for QR Code Display ---
const server = http.createServer(async (req, res) => {
    if (req.url === '/api/qr') {
        try {
            const qrContent = await fs.promises.readFile(QR_FILE, 'utf-8');
            const qrDataUrl = await QRCode.toDataURL(qrContent);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ qr: qrDataUrl }));
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ qr: null, message: 'QR code not generated yet or already scanned.' }));
        }
        return;
    }

    // Serve static files from 'public' directory
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- Core Bot Logic ---

async function startBot() {
    if (isConnecting) {
        console.log('startBot: Connection attempt already in progress. Aborting.');
        return;
    }
    isConnecting = true;

    try {
        console.log('Starting bot connection...');

        // Cleanup old socket
        if (sock) {
            sock.ev.removeAllListeners();
            try {
                sock.end(new Error('Restarting...'));
            } catch {}
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger: P({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
            },
            connectTimeoutMs: 60_000,
            syncFullHistory: false,
            browser: ['Gemini-Bot', 'Chrome', '1.0.0']
        });

        // Attach event listeners
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => handleConnectionUpdate(update));
        sock.ev.on('messages.upsert', (msg) => handleMessage(msg));

        console.log('Socket created and handlers attached.');

    } catch (err) {
        console.error("Error during bot start:", err);
        isConnecting = false; // Reset flag on failure to allow retry
        scheduleReconnect();
    }
}

async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        console.log('QR code generated. Scan it to log in.');
        try {
            await fs.promises.writeFile(QR_FILE, qr);
        } catch (err) {
            console.error('Failed to write QR file:', err);
        }
    }

    if (connection === 'open') {
        console.log('✅ Connection opened!');
        isConnecting = false; // Connection successful, reset the flag
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        try {
            await fs.promises.unlink(QR_FILE);
        } catch {}
    }

    if (connection === 'close') {
        isConnecting = false; // Connection closed, allow a new attempt
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.warn(`❌ Connection closed. Reason: ${DisconnectReason[statusCode] || 'Unknown'} (Code: ${statusCode})`);

        if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.connectionReplaced || statusCode === DisconnectReason.multideviceMismatch) {
            console.error('Critical error. The bot will now exit.');
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('Cleaning authentication data...');
                // Use synchronous removal on critical exit path
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                }
            }
            // The lock will be released by the main process exit handler
            process.exit(1);
        }
        else {
            scheduleReconnect();
        }
    }
}

function scheduleReconnect() {
    if (reconnectTimer) {
        console.log('Reconnect already scheduled.');
        return;
    }
    const delay = 5000; // 5 seconds
    console.log(`Scheduling reconnect in ${delay / 1000} seconds...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot().catch(e => console.error('Reconnect failed:', e));
    }, delay);
}

async function handleMessage({ messages }) {
    try {
        const msg = messages && messages[0];
        if (!msg || !msg.message || msg.key?.fromMe) return;

        const sender = msg.key.remoteJid;
        if (sender?.endsWith?.('@g.us')) return; // Ignore group messages

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        console.log(`📩 Message from ${sender}: ${text || '[Non-text message]'}`);

        const wasNewUser = isNewUser(sender);
        await saveMedia(msg, sock, sender);
        if (!text) return;
        await saveChatHistory(sender, text);

        if (wasNewUser) {
            const welcomeMessage = `Selamat datang di Layanan Pelanggan WiFi! 👋\n\nSaya adalah asisten virtual yang siap membantu Anda dengan berbagai pertanyaan seputar layanan kami.`;
            await sock.sendMessage(sender, { text: welcomeMessage });
            await saveChatHistory(sender, welcomeMessage, true);
        }

        const greetingReply = getGreetingResponse(text);
        if (greetingReply && !wasNewUser) {
            await sock.sendMessage(sender, { text: greetingReply });
            await saveChatHistory(sender, greetingReply, true);
            return;
        }

        const infoReply = getInfoResponse(text);
        if (infoReply) {
            await sock.sendMessage(sender, { text: infoReply });
            await saveChatHistory(sender, infoReply, true);
            return;
        }

        if (wasNewUser && getGreetingResponse(text)) {
            const followUp = "Silakan ajukan pertanyaan Anda mengenai layanan kami. Misalnya: Berapa harga paket internet?";
            await sock.sendMessage(sender, { text: followUp });
            await saveChatHistory(sender, followUp, true);
            return;
        }

        try {
            const salutation = wasNewUser ? '' : getGreetingResponse(text, true) + ', ';
            const response = await axios.post('http://160.25.222.84:8001/chat', { query: text }, { timeout: 20000 });
            const responseText = (response.data?.response || '').trim().replace(/^/gm, '👉 ');
            const friendlyOutput = `${salutation}${responseText}`.concat('\n\nKalau ada pertanyaan lain, tinggal chat aja ya 😊');

            await sock.sendMessage(sender, { text: friendlyOutput });
            await saveChatHistory(sender, friendlyOutput, true);
        } catch (err) {
            console.error('❌ Error from Python API:', err.message || err);
            const errorMessage = 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.';
            await sock.sendMessage(sender, { text: errorMessage });
            await saveChatHistory(sender, errorMessage, true);
        }

    } catch (err) {
        console.error('Error in message handler:', err);
    }
}

// --- Helper Functions (copied from your original file) ---
async function saveChatHistory(sender, message, isBot = false) {
    const historyDir = path.join(__dirname, 'chat_history');
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
    const logFile = path.join(historyDir, `${sender.split('@')[0]}.log`);
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const logMessage = `[${timestamp}] ${isBot ? 'Bot' : 'User'}: ${message}\n`;
    try {
        await fs.promises.appendFile(logFile, logMessage);
    } catch (error) {
        console.error('❌ Failed to save chat history:', error);
    }
}

function isNewUser(sender) {
    const historyDir = path.join(__dirname, 'chat_history');
    const logFile = path.join(historyDir, `${sender.split('@')[0]}.log`);
    return !fs.existsSync(logFile);
}

function getGreetingResponse(text, forceSalutation = false) {
    const greetings = ['hi', 'halo', 'hai', 'assalamualaikum', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam', 'misi', 'permisi', 'p', 'permisi kak'];
    const normalizedText = text ? text.toLowerCase().trim() : '';
    const hour = new Date().getHours();
    let waktu = 'malam';
    if (hour >= 5 && hour < 11) waktu = 'pagi';
    else if (hour >= 11 && hour < 15) waktu = 'siang';
    else if (hour >= 15 && hour < 18) waktu = 'sore';
    const salutation = `Selamat ${waktu}`;
    if (greetings.includes(normalizedText)) {
        return `${salutation} juga! 😊 Ada yang bisa aku bantu? Kamu bisa tanya misalnya:\n- Paket WiFi yang tersedia\n- Cara pembayaran\n- Hubungi teknisi\n\nSilakan tanyakan ya~`;
    }
    if (forceSalutation) return salutation;
    return null;
}

function getInfoResponse(text) {
    const lowerText = text ? text.toLowerCase() : '';
    if (lowerText.includes('alamat') || lowerText.includes('lokasi') || lowerText.includes('kantor')) {
        return `📍 Lokasi kantor kami:\nPT. Telemedia Prima Nusantara\nhttps://www.google.com/maps/place/PT.+Telemedia+Prima+Nusantara/@-2.9325764,104.7025048,17z`;
    }
    if (lowerText.includes('teknisi') || lowerText.includes('perbaikan') || lowerText.includes('gangguan')) {
        return `🔧 Untuk perbaikan atau gangguan, silakan hubungi teknisi kami di: 0851-7205-1808`;
    }
    return null;
}

async function saveMedia(msg, sockInstance, sender) {
    const mediaType = Object.keys(msg.message || {}).find(key => ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'locationMessage'].includes(key));
    if (!mediaType) return;
    const mediaMessage = msg.message[mediaType];
    const folderPath = path.join(__dirname, 'media', sender.replace(/[@:\.]/g, '_'));
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    let fileName = '';
    if (mediaType === 'locationMessage') {
        fileName = 'location_' + Date.now() + '.json';
        fs.writeFileSync(path.join(folderPath, fileName), JSON.stringify(mediaMessage, null, 2));
        console.log(`📍 Location from ${sender} saved.`);
        return;
    }
    const stream = await downloadMediaMessage(msg, "buffer", {}, { logger: P({ level: 'silent' }), reuploadRequest: sockInstance.updateMediaMessage });
    switch (mediaType) {
        case 'imageMessage': fileName = 'image_' + Date.now() + '.jpg'; break;
        case 'videoMessage': fileName = 'video_' + Date.now() + '.mp4'; break;
        case 'audioMessage': fileName = 'audio_' + Date.now() + '.mp3'; break;
        case 'documentMessage': fileName = mediaMessage.fileName || 'document_' + Date.now(); break;
    }
    if (fileName) {
        fs.writeFileSync(path.join(folderPath, fileName), stream);
        console.log(`💾 ${mediaType} from ${sender} saved as ${fileName}`);
    }
}

// --- Main Application Entry Point ---
async function main() {
    try {
        // Ensure the lockfile exists before trying to lock it, to prevent ENOENT errors on some systems.
        if (!fs.existsSync(LOCK_FILE)) {
            await fs.promises.writeFile(LOCK_FILE, '');
        }

        // Acquire a lock to ensure single instance
        await lockfile.lock(LOCK_FILE, { retries: 0 });
        console.log('Lock acquired. Starting application.');

        // Start the HTTP server
        server.listen(3000, () => {
            console.log('Server listening on port 3000. Access the QR code UI at http://localhost:3000');
        });

        // Start the bot
        await startBot();

    } catch (error) {
        if (error.code === 'ELOCKED') {
            console.error('Another instance of the application is already running. Exiting.');
            process.exit(1);
        } else {
            console.error('Failed to start application:', error);
            process.exit(1);
        }
    }
}

// Graceful shutdown handler
async function gracefulShutdown() {
    console.log('Shutting down gracefully...');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (sock) {
        sock.ev.removeAllListeners();
        try {
            sock.end(new Error('Shutdown'));
        } catch {}
    }
    try {
        await lockfile.unlock(LOCK_FILE);
        console.log('Lock released.');
    } catch (e) {
        console.error('Failed to release lock:', e);
    }
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
    // Force exit if server doesn't close in time
    setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Run the main application
main();
