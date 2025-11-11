import tiktoken
from config.settings import CHAT_MODEL

encoding = tiktoken.encoding_for_model(model_name=CHAT_MODEL)

def count_tokens(text: str) -> int:
    return len(encoding.encode(text))

def truncate_by_token(text: str, max_tokens: int) -> str:
    tokens = encoding.encode(text)
    truncated_tokens = tokens[:max_tokens]
    return encoding.decode(truncated_tokens)

