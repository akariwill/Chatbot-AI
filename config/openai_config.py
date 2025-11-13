import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from config.settings import OPENAI_API_KEY, EMBEDDING_MODEL, CHAT_MODEL

load_dotenv()

def get_llm():
    return ChatOpenAI(
        model=CHAT_MODEL,
        temperature=0,
        openai_api_key=OPENAI_API_KEY,
    )

def get_embedding_model():
    return OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=OPENAI_API_KEY,
    )