import json
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from config.settings import GOOGLE_API_KEY, EMBEDDING_MODEL, CHAT_MODEL

# Load data
def load_data(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

# Build retriever
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

# Build Chat LLM
def build_chat_model():
    return ChatGoogleGenerativeAI(
        google_api_key=GOOGLE_API_KEY,
        model=CHAT_MODEL,
        temperature=0.2,
        streaming=True
    )

# Format prompt
def build_prompt(query, docs):
    context = "\n\n".join([doc.page_content for doc in docs])
    template = f"""
Anda adalah asisten pelanggan layanan WiFi yang profesional dan ramah.
Gunakan informasi berikut (pertanyaan dan jawaban customer service sebelumnya) untuk membantu pelanggan.
Jangan langsung menyalin jawaban. Pahami dulu konteks sebelum menjawab.

Jika informasi tidak cukup relevan, jawab dengan sopan dan tawarkan bantuan tambahan.

Format jawaban:
- Sapa pelanggan dengan ramah.
- Jawab dengan jelas dan bahasa mudah dipahami.
- Akhiri dengan menawarkan bantuan lebih lanjut.

Berikut pertanyaan dari pelanggan:
{query}

Berikut adalah informasi terkait dari basis data:
{context}

Jika informasi di database tidak cukup untuk menjawab, mohon sampaikan dengan sopan bahwa Anda akan menghubungkan pelanggan ke Customer Support manusia.

Jawaban:
"""
    return template
