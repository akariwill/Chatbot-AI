import logging

def setup_logger():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        filename='/tmp/chatbot.log',
        filemode='a'
    )
    logging.getLogger("faiss").setLevel(logging.ERROR)
