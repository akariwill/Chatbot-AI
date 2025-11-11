import os
import logging
from utils.logger import setup_logger
from chain.qa_chain import load_data, build_retriever, build_chat_model, build_prompt
from utils.filter_utils import is_relevant_question


retriever = None
chat_model = None

def chatbot_response(user_input: str) -> str:
    global retriever, chat_model

    if not is_relevant_question(user_input):
        return (
            "Maaf, saya hanya bisa membantu pertanyaan seputar layanan WiFi kami, seperti:\n"
            "- Harga paket WiFi\n"
            "- Cara pasang WiFi\n"
            "- Menghubungi teknisi\n"
            "- Masalah koneksi atau gangguan\n\n"
            "Silakan ajukan pertanyaan sesuai layanan ya 😊"
        )

    if not retriever or not chat_model:
        raise ValueError("Chatbot belum diinisialisasi. Jalankan initialize_chatbot() dulu.")

    relevant_docs = retriever.invoke(user_input)

    if not relevant_docs:
        return (
            "Maaf, aku belum menemukan jawaban untuk pertanyaan itu 😔.\n"
            "Coba tanyakan dengan kata lain atau cek pertanyaan umum seperti:\n"
            "- Berapa harga paket WiFi\n- Cara pasang WiFi\n- Cara menghubungi teknisi"
        )

    full_prompt = build_prompt(user_input, relevant_docs)

    response_text = ""
    for chunk in chat_model.stream(full_prompt):
        if chunk.content:
            response_text += chunk.content

    return response_text.strip()



def initialize_chatbot():
    global retriever, chat_model
    setup_logger()
    logging.info("Memulai Chatbot WiFi...")

    try:

        DATA_DIR = os.getenv("DATA_DIR", "./data")
        faq_data = load_data(os.path.join(DATA_DIR, "faq_data.json"))
        retrieval_data = load_data(os.path.join(DATA_DIR, "retrieval_data.json"))

        all_data = faq_data + retrieval_data

        retriever = build_retriever(all_data)
        chat_model = build_chat_model()

        return retriever, chat_model

    except Exception as e:
        logging.error(f"❌ Error saat inisialisasi chatbot: {e}")
        return None, None

def cli_chat():
    retriever_, chat_model_ = initialize_chatbot()
    if not retriever_ or not chat_model_:
        print("❌ Gagal inisialisasi chatbot.")
        return

    print("🗨️ Chatbot WiFi - Ketik 'exit' untuk keluar.")
    while True:
        user_input = input("📝 Anda: ")
        if user_input.lower() == "exit":
            print("👋 Terima kasih telah menggunakan Chatbot WiFi!")
            break
        try:
            response = chatbot_response(user_input)
            print("🤖 Bot:", response)
        except Exception as e:
            logging.error(f"Error saat memproses pertanyaan: {e}")
            print("❌ Error:", e)

if __name__ == "__main__":
    cli_chat()