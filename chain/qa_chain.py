import json
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from config.settings import GOOGLE_API_KEY, EMBEDDING_MODEL, CHAT_MODEL

def count_tokens(text: str) -> int:
    return len(text)

def truncate_by_token(text: str, max_tokens: int) -> str:
    return text[:max_tokens]

def load_data(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        if not data:
            print(f"[WARNING] File {filepath} kosong atau gagal dibaca.")
        return data

def build_retriever(data):
    texts = []
    for item in data:
        q = item.get("customer", "")
        a = item.get("cs", "")
        combined = f"Q: {q}\nA: {a}"
        texts.append(Document(page_content=combined))
    
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    documents = splitter.split_documents(texts)

    embeddings = GoogleGenerativeAIEmbeddings(google_api_key=GOOGLE_API_KEY, model=EMBEDDING_MODEL)
    vectordb = FAISS.from_documents(documents, embedding=embeddings)
    retriever = vectordb.as_retriever(search_kwargs={"k": 4})
    return retriever

def build_chat_model():
    return ChatGoogleGenerativeAI(
        google_api_key=GOOGLE_API_KEY,
        model=CHAT_MODEL,
        temperature=0.2,
        streaming=True
    )

def build_prompt(query, docs, max_prompt_tokens=3500):
    header = f"""
Anda adalah asisten pelanggan layanan WiFi yang profesional dan ramah.
Anda HARUS mengikuti instruksi format jawaban dengan tepat.

Instruksi:
- JANGAN menyertakan sapaan (seperti Selamat pagi/siang/sore/malam) di awal jawaban Anda.
- Gunakan informasi berikut (pertanyaan dan jawaban customer service sebelumnya) untuk membantu pelanggan.
- Jangan langsung menyalin jawaban. Pahami dulu konteks sebelum menjawab.
- Jika informasi tidak cukup relevan, jawab dengan sopan dan tawarkan bantuan tambahan.
- Jawab dengan jelas dan bahasa mudah dipahami.
- Akhiri dengan menawarkan bantuan lebih lanjut.

Berikut pertanyaan dari pelanggan:
{query}

Berikut adalah informasi terkait dari basis data:
"""
    header_tokens = count_tokens(header)

    context = "\n\n".join([doc.page_content for doc in docs])

    remaining_tokens = max_prompt_tokens - header_tokens
    truncated_context = truncate_by_token(context, remaining_tokens)

    footer = """

Jika informasi di database tidak cukup untuk menjawab, mohon sampaikan dengan sopan bahwa Anda akan menghubungkan pelanggan ke Customer Support manusia.

Jawaban:
"""

    prompt = header + truncated_context + footer
    return prompt