from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from config.settings import EMBEDDING_MODEL

def build_vectorstore(documents):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    split_docs = text_splitter.split_documents(documents)
    embedding_model = GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
    )
    vectorstore = FAISS.from_documents(split_docs, embedding_model)
    return vectorstore
