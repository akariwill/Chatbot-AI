import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from config.settings import GOOGLE_API_KEY, EMBEDDING_MODEL, CHAT_MODEL

load_dotenv()

def get_llm():
    return ChatGoogleGenerativeAI(
        model=CHAT_MODEL,
        temperature=0,
        google_api_key=GOOGLE_API_KEY,
    )

def get_embedding_model():
    return GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=GOOGLE_API_KEY,
    )