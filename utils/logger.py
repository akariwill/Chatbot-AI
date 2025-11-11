import logging

def setup_logger():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    ),
    logging.getLogger("faiss").setLevel(logging.ERROR)
