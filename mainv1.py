import logging
from utils.logger import setup_logger
from chain.qa_chain import load_data, build_retriever, build_chat_model, build_prompt

def main():
    setup_logger()
    logging.info("Memulai Chatbot WiFi...")

    faq_data = load_data("/home/akari/chatbot/data/faq_data.json")
    retrieval_data = load_data("/home/akari/chatbot/data/retrieval_data.json")
    all_data = faq_data + retrieval_data

    retriever = build_retriever(all_data)
    chat_model = build_chat_model()

    print("🗨️ Chatbot WiFi - Ketik 'exit' untuk keluar.")

    while True:
        user_input = input("📝 Anda: ")
        if user_input.lower() == "exit":
            print("👋 Terima kasih telah menggunakan Chatbot WiFi!")
            break
        
        try:
            relevant_docs = retriever.invoke(user_input)
            full_prompt = build_prompt(user_input, relevant_docs)

            response_stream = chat_model.stream(full_prompt)
            print("🤖 Bot:", end=" ", flush=True)

            for chunk in response_stream:
                if chunk.content:
                    print(chunk.content, end="", flush=True)
            print()

        except Exception as e:
            logging.error(f"Error saat memproses pertanyaan: {e}")

if __name__ == "__main__":
    main()
