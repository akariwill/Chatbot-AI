import fetch from "node-fetch";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "許可されていないメソッド" });
    }

    try {
        const { query } = req.body;

        if (!query) return res.status(400).json({ error: "クエリが必要です" });

        const response = await fetch("http://160.25.222.84:8001/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "チャットAPIエラー" });
    }
}
