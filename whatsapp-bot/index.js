
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

const QR_FILE = path.join(os.tmpdir(), 'last_qr.txt');
const AUTH_FOLDER = './auth_info';

let sock = null;
let isStarting = false;
let reconnectTimer = null;

const server = http.createServer(async (req, res) => {
    if (req.url === '/api/qr') {
        try {
            const qrContent = await fs.promises.readFile(QR_FILE, 'utf-8');
            if (!qrContent) throw new Error('empty');
            const qrDataUrl = await QRCode.toDataURL(qrContent);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ qr: qrDataUrl }));
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ qr: null, message: 'QR code not generated yet.' }));
        }
        return;
    }

    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + err.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000. Access it via http://160.25.222.84:3000/');
    console.log('QR code will be available on the website.');
});

async function saveChatHistory(sender, message, isBot = false) {
    const historyDir = path.join(__dirname, 'chat_history');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }

    const logFile = path.join(historyDir, `${sender.split('@')[0]}.log`);
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const logMessage = `[${timestamp}] ${isBot ? 'Bot' : 'User'}: ${message}\n`;

    try {
        await fs.promises.appendFile(logFile, logMessage);
    } catch (error) {
        console.error('❌ Gagal menyimpan riwayat chat:', error);
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

    if (forceSalutation) {
        return salutation;
    }

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
    const mediaType = Object.keys(msg.message || {}).find(key =>
        ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'locationMessage'].includes(key)
    );
    if (!mediaType) return;

    const mediaMessage = msg.message[mediaType];
    const folderPath = path.join(__dirname, 'media', sender.replace(/[@:\.]/g, '_'));
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    let fileName = '';
    if (mediaType === 'locationMessage') {
        fileName = 'location_' + Date.now() + '.json';
        const locationData = {
            latitude: mediaMessage.degreesLatitude,
            longitude: mediaMessage.degreesLongitude,
            name: mediaMessage.name || '',
            address: mediaMessage.address || ''
        };
        fs.writeFileSync(path.join(folderPath, fileName), JSON.stringify(locationData, null, 2));
        console.log(`📍 Lokasi dari ${sender} disimpan.`);
        return;
    }

    const stream = await downloadMediaMessage(msg, "buffer", {}, {
        logger: P({ level: 'silent' }),
        reuploadRequest: sockInstance.updateMediaMessage
    });

    switch (mediaType) {
        case 'imageMessage':
            fileName = 'image_' + Date.now() + '.jpg';
            break;
        case 'videoMessage':
            fileName = 'video_' + Date.now() + '.mp4';
            break;
        case 'audioMessage':
            fileName = 'audio_' + Date.now() + '.mp3';
            break;
        case 'documentMessage':
            fileName = mediaMessage.fileName || 'document_' + Date.now();
            break;
    }

    if (fileName) {
        const filePath = path.join(folderPath, fileName);
        fs.writeFileSync(filePath, stream);
        console.log(`💾 ${mediaType} dari ${sender} disimpan sebagai ${fileName}`);
    }
}

async function startSock() {
    if (isStarting) {
        console.log('startSock: already starting, skip.');
        return;
    }
    isStarting = true;

    try {
        // ensure no duplicate socket running
        if (sock) {
            try { sock.ev.removeAllListeners(); sock.end(); } catch (e) { /* ignore */ }
            sock = null;
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
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const msg = messages && messages[0];
                if (!msg || !msg.message || msg.key?.fromMe) return;

                const sender = msg.key.remoteJid;
                const isGroup = sender?.endsWith?.('@g.us');
                if (isGroup) return;

                const wasNewUser = isNewUser(sender);

                await saveMedia(msg, sock, sender);

                const text = msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text);
                if (!text) return;

                await saveChatHistory(sender, text);
                console.log(`📩 Pesan diterima dari ${sender}: ${text}`);

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
                    console.error('❌ Error dari Python API:', err.message || err);
                    const errorMessage = 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.';
                    await sock.sendMessage(sender, { text: errorMessage });
                    await saveChatHistory(sender, errorMessage, true);
                }
            } catch (innerErr) {
                console.error('messages.upsert handler error:', innerErr);
            }
        });

        sock.ev.on('connection.update', async (update) => {
            try {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    // write QR content as-is (string)
                    try {
                        await fs.promises.writeFile(QR_FILE, qr);
                        console.log('🔄 QR code updated and saved.');
                    } catch (err) {
                        console.error('Failed to write QR code to file:', err);
                    }
                }

                if (connection === 'open') {
                    console.log('✅ Terhubung ke WhatsApp!');
                    // Do not delete auth or QR here (keep for safety). Optionally remove QR file to hide it:
                    try {
                        if (fs.existsSync(QR_FILE)) {
                            await fs.promises.unlink(QR_FILE).catch(() => {});
                        }
                    } catch (err) { /* ignore */ }
                }

                if (connection === 'close') {
                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    console.warn('❌ Connection closed. Reason:', reason, util.inspect(lastDisconnect?.error, { depth: null }));

                    const shouldReconnect = reason !== DisconnectReason.loggedOut;
                    console.log('Should reconnect:', shouldReconnect);

                    if (shouldReconnect) {
                        // schedule reconnect with backoff
                        if (reconnectTimer) clearTimeout(reconnectTimer);
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            console.log('🔁 Reconnecting now...');
                            startSock();
                        }, 4000);
                    } else {
                        console.log('🚪 Logged out (user logged out). Please remove auth folder and re-scan QR to login again.');
                        // if logged out, remove auth folder so next run is clean
                        try {
                            await fs.promises.rm(AUTH_FOLDER, { recursive: true, force: true });
                        } catch (err) {
                            console.error('Failed to remove auth folder:', err);
                        }
                    }
                }
            } catch (err) {
                console.error('connection.update handler error:', err);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        console.log('startSock: socket created.');
    } catch (err) {
        console.error('startSock error:', err);
        // try reconnect after a delay
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startSock();
        }, 5000);
    } finally {
        isStarting = false;
    }
}

// graceful shutdown
process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    try {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (sock) {
            try { sock.ev.removeAllListeners(); sock.end(); } catch (e) {}
        }
        process.exit(0);
    } catch (e) {
        process.exit(1);
    }
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});

startSock();