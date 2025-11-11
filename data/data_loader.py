import json
from langchain.schema import Document

def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def format_documents(data):
    return [Document(page_content=f"Q: {d['customer']}\nA: {d['cs']}") for d in data]
