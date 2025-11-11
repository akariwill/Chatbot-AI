from langchain_google_genai import GoogleGenerativeAIEmbeddings
import numpy as np
import os
from config.settings import GOOGLE_API_KEY, EMBEDDING_MODEL

TOPIK_WIFI = [
    "Bagaimana cara pasang wifi?",
    "Berapa harga paket internet?",
    "Saya mengalami gangguan jaringan",
    "Nomor teknisi wifi",
    "Dimana lokasi kantor wifi?",
    "Bagaimana cara bayar tagihan wifi?",
    "Ada promo wifi?",
]

embedding_model = GoogleGenerativeAIEmbeddings(
    google_api_key=GOOGLE_API_KEY,
    model=EMBEDDING_MODEL
)

# Cache for TOPIK_WIFI embeddings
_topik_embeddings_cache = None

def get_embeddings(texts: list[str]) -> list[list[float]]:
    return embedding_model.embed_documents(texts)

def cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def is_relevant_question(user_question: str, threshold: float = 0.80) -> bool:
    global _topik_embeddings_cache
    try:
        user_embedding = get_embeddings([user_question])[0]
        
        if _topik_embeddings_cache is None:
            _topik_embeddings_cache = get_embeddings(TOPIK_WIFI)
        topik_embeddings = _topik_embeddings_cache

        similarities = [cosine_similarity(user_embedding, topik_emb) for topik_emb in topik_embeddings]
        max_similarity = max(similarities)

        return max_similarity >= threshold
    except Exception as e:
        print("❌ Error dalam proses filtering topik:", e)
        return True