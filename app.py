from fastapi import FastAPI, Request
from main import initialize_chatbot, chatbot_response
import uvicorn

app = FastAPI()
retriever, chat_model = initialize_chatbot()

@app.post("/chat")
async def chat_endpoint(request: Request):
    data = await request.json()
    query = data.get("query", "")
    if not query:
        return {"error": "Query not provided"}, 400

    try:
        response = chatbot_response(query)
        if not response or response.strip() == "":
            return {"response": "Maaf, aku belum punya jawaban untuk itu 😔\nCoba tanya hal lain, misalnya:\n- Harga paket internet\n- Cara daftar\n- Info teknisi"}
        else:
            return {"response": response.strip()}
    except Exception as e:
        return {"error": str(e)}, 500

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
