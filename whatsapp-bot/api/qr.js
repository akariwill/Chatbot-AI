import QRCode from "qrcode";

let lastQR = null;

// Update QR from Baileys
export function setQR(qr) {
    lastQR = qr;
}

// Serverless handler
export default async function handler(req, res) {
    try {
        if (!lastQR) {
            return res.status(200).json({ qr: null });
        }
        const qrDataUrl = await QRCode.toDataURL(lastQR);
        res.status(200).json({ qr: qrDataUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate QR" });
    }
}
