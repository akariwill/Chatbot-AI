from flask import Flask, request, jsonify
from flask_cors import CORS
from main import initialize_chatbot, chatbot_response
import os
import qrcode
import io
import base64

app = Flask(__name__)
CORS(app) 

retriever, chat_model = initialize_chatbot()

# Path to the temporary file where the QR code string is stored
# This path needs to be accessible by both the Node.js bot and this Flask app
QR_FILE_PATH = os.path.join(os.path.expanduser('~'), '.gemini', 'tmp', 'b8b055e69170e7d462d0ace0dfd152526e8922e24b1f262090b10eb6eebdfc21', 'last_qr.txt')


@app.route("/", methods=["GET"])
def home():
    return "Chatbot WiFi server is running!"


@app.route("/api/qr", methods=["GET"])
def get_qr_code():
    try:
        if not os.path.exists(QR_FILE_PATH):
            return jsonify({"qr": None, "message": "QR code not generated yet."}), 200

        with open(QR_FILE_PATH, "r") as f:
            qr_content = f.read().strip()

        if not qr_content:
            return jsonify({"qr": None, "message": "QR code is empty."}), 200

        # Generate QR code image in memory
        img = qrcode.make(qr_content)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        img_bytes = buf.getvalue()
        
        # Encode to base64 Data URL
        qr_data_url = "data:image/png;base64," + base64.b64encode(img_bytes).decode('utf-8')

        return jsonify({"qr": qr_data_url}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to generate QR code: {str(e)}"}), 500


@app.route("/chat", methods=["POST"])
def chat_endpoint():
    data = request.get_json()

    if not data or "query" not in data:
        return jsonify({"error": "Query not provided"}), 400

    query = data["query"]

    try:
        response = chatbot_response(query)

        if not response or response.strip() == "":
            return jsonify({
                "response": (
                    "Maaf, aku belum punya jawaban untuk itu 😔\n"
                    "Coba tanya hal lain, misalnya:\n"
                    "- Harga paket internet\n"
                    "- Cara daftar\n"
                    "- Info teknisi"
                )
            }), 200

        return jsonify({"response": response.strip()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Untuk running lokal (tidak perlu di PythonAnywhere)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=True)
