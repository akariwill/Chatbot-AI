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
const path = require('path');
const express = require('express');
const qrcode = require('qrcode');

// --- State Management ---
let sock;
let qrCode;
let connectionStatus = 'DISCONNECTED'; // Can be: DISCONNECTED, CONNECTING, WAITING_FOR_QR, CONNECTED

// --- Express App Setup ---
const app = express();
const port = 3000;
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---
app.get('/api/status', (req, res) => {
    res.json({ status: connectionStatus });
});

app.get('/api/qr', async (req, res) => {
    if (qrCode) {
        try {
            const qrDataUrl = await qrcode.toDataURL(qrCode);
            res.json({ qr: qrDataUrl });
        } catch (err) {
            console.error('❌ QRコードのデータURL作成に失敗しました:', err);
            res.status(500).json({ error: 'QRコードの処理に失敗しました' });
        }
    } else {
        res.status(404).json({ error: 'QRコードは利用できません' });
    }
});

app.post('/api/logout', async (req, res) => {
    if (sock) {
        try {
            await sock.logout();
        } catch (err) {
            console.error('❌ ソケットからのログアウトに失敗しました:', err);
        }
    }

    const authInfoDir = path.join(__dirname, 'auth_info');
    if (fs.existsSync(authInfoDir)) {
        fs.rmSync(authInfoDir, { recursive: true, force: true });
    }

    connectionStatus = 'DISCONNECTED';
    console.log('✅ 正常にログアウトし、接続を再開します。');
    res.json({ message: 'ログアウトに成功しました。ページを更新してください。' });
    // The connection.update handler will automatically call startSock() on loggedOut disconnect
});


// --- Bot Business Logic (unchanged) ---
async function saveChatHistory(sender, message, isBot = false) {
    const historyDir = path.join(__dirname, 'chat_history');
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
    const logFile = path.join(historyDir, `${sender.split('@')[0]}.log`);
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const logMessage = `[${timestamp}] ${isBot ? 'Bot' : 'User'}: ${message}\n`;
    try {
        await fs.promises.appendFile(logFile, logMessage);
    } catch (error) {
        console.error('❌ チャット履歴の保存に失敗しました:', error);
    }
}

function isNewUser(sender) {
    const historyDir = path.join(__dirname, 'chat_history');
    const logFile = path.join(historyDir, `${sender.split('@')[0]}.log`);
    return !fs.existsSync(logFile);
}

function getGreetingResponse(text, forceSalutation = false) {
    const greetings = ['hi', 'halo', 'hai', 'assalamualaikum', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam', 'misi', 'permisi', 'p', 'permisi kak'];
    const normalizedText = text?.toLowerCase().trim();
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
    const lowerText = text.toLowerCase();
    if (lowerText.includes('alamat') || lowerText.includes('lokasi') || lowerText.includes('kantor')) {
        return `📍 Lokasi kantor kami:\nPT. Telemedia Prima Nusantara\nhttps://www.google.com/maps/place/PT.+Telemedia+Prima+Nusantara/@-2.9325764,104.7025048,17z`;
    }
    if (lowerText.includes('teknisi') || lowerText.includes('perbaikan') || lowerText.includes('gangguan')) {
        return `🔧 Untuk perbaikan atau gangguan, silakan hubungi teknisi kami di: 0851-7205-1808`;
    }
    return null;
}

async function saveMedia(msg, sockInstance, sender) {
    const mediaType = Object.keys(msg.message).find(key => ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'locationMessage'].includes(key));
    if (!mediaType) return;
    const mediaMessage = msg.message[mediaType];
    const folderPath = path.join(__dirname, 'media', sender.replace(/[@:\.]/g, '_'));
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    let fileName = '';
    if (mediaType === 'locationMessage') {
        fileName = 'location_' + Date.now() + '.json';
        const locationData = { latitude: mediaMessage.degreesLatitude, longitude: mediaMessage.degreesLongitude, name: mediaMessage.name || '', address: mediaMessage.address || '' };
        fs.writeFileSync(path.join(folderPath, fileName), JSON.stringify(locationData, null, 2));
        console.log(`📍 ${sender} からの場所が保存されました。`);
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
        const filePath = path.join(folderPath, fileName);
        fs.writeFileSync(filePath, stream);
        console.log(`💾 ${sender} からの ${mediaType} は ${fileName} として保存されました。`);
    }
}

// --- Baileys Connection Logic ---
async function startSock() {
    connectionStatus = 'CONNECTING';
    console.log('🚀 ソケット接続を開始しています...');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
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
        if (sender.endsWith('@g.us')) return;
        const wasNewUser = isNewUser(sender);
        await saveMedia(msg, sock, sender);
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;
        await saveChatHistory(sender, text);
        console.log(`📩 ${sender} からメッセージを受信しました: ${text}`);
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
            const response = await axios.post('http://160.25.222.84:8001/chat', { query: text });
            const responseText = response.data.response.trim().replace(/^/gm, '👉 ');
            const friendlyOutput = `${salutation}${responseText}`.concat('\n\nKalau ada pertanyaan lain, tinggal chat aja ya 😊');
            await sock.sendMessage(sender, { text: friendlyOutput });
            await saveChatHistory(sender, friendlyOutput, true);
        } catch (error) {
            console.error('❌ Python APIからのエラー:', error.message);
            const errorMessage = 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.';
            await sock.sendMessage(sender, { text: errorMessage });
            await saveChatHistory(sender, errorMessage, true);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCode = qr;
            connectionStatus = 'WAITING_FOR_QR';
            console.log('✅ QRコードを受信しました。スキャンをお待ちください。');
        }

        if (connection === 'close') {
            qrCode = undefined;
            connectionStatus = 'DISCONNECTED';
            
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

            if (reason === DisconnectReason.loggedOut) {
                console.log('🔌 接続が永久に切断されました: ログアウト。セッションを削除して再起動します...');
                const authInfoDir = path.join(__dirname, 'auth_info');
                if (fs.existsSync(authInfoDir)) {
                    fs.rmSync(authInfoDir, { recursive: true, force: true });
                }
            } else {
                 console.log(`🔌 接続が切断されました: ${lastDisconnect.error?.message}。再接続を試みています...`);
            }

            // Always attempt to restart the connection on any close event
            startSock();

        } else if (connection === 'open') {
            qrCode = undefined;
            connectionStatus = 'CONNECTED';
            console.log('✅ WhatsAppに接続しました！');
        }
    });
}

// --- Start Application ---
app.listen(port, () => {
    console.log(`✅ ウェブサイトは http://localhost:${port} で実行中です`);
    // Start the bot after the server is running
    startSock();
});
