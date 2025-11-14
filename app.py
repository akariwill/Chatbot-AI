from flask import Flask, request, jsonify
from flask_cors import CORS
from main import initialize_chatbot, chatbot_response

app = Flask(__name__)
CORS(app) 

retriever, chat_model = initialize_chatbot()


@app.route("/", methods=["GET"])
def home():
    return "Chatbot WiFi server is running!"


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
