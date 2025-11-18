from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from main import initialize_chatbot, chatbot_response
import os
import qrcode
import io
import base64

app = Flask(__name__)
CORS(app) 

retriever, chat_model = initialize_chatbot()

QR_FILE_PATH = '/tmp/last_qr.txt'


@app.route("/", methods=["GET"])
def home():
    return render_template('index.html')


@app.route("/api/qr", methods=["GET"])
def get_qr_code():
    try:
        if not os.path.exists(QR_FILE_PATH):
            return jsonify({"qr": None, "message": "QR code not generated yet."}), 200

        with open(QR_FILE_PATH, "r") as f:
            qr_content = f.read().strip()

        if not qr_content:
            return jsonify({"qr": None, "message": "QR code is empty."}), 200

        img = qrcode.make(qr_content)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        img_bytes = buf.getvalue()
        
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


@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=True)
