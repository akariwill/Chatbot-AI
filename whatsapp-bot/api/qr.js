import QRCode from "qrcode";
import fs from "fs/promises";
import path from "path";

const QR_FILE = path.join("/tmp", "last_qr.txt");

// Serverless handler
export default async function handler(req, res) {
    try {
        let qrContent;
        try {
            qrContent = await fs.readFile(QR_FILE, "utf-8");
        } catch (readErr) {
            // If the file doesn't exist, it's not an error, just no QR yet.
            if (readErr.code === 'ENOENT') {
                return res.status(200).json({ qr: null, message: "QR コードはまだ生成されていません。" });
            }
            // For other read errors, treat it as a server issue.
            throw readErr;
        }

        if (!qrContent) {
            return res.status(200).json({ qr: null, message: "QRコードが空です。" });
        }

        const qrDataUrl = await QRCode.toDataURL(qrContent);
        res.status(200).json({ qr: qrDataUrl });

    } catch (err) {
        console.error("Error in /api/qr:", err);
        res.status(500).json({ error: "QR コードの生成に失敗しました。", details: err.message });
    }
}