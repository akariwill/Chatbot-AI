from openai import OpenAI
import pandas as pd
import tiktoken
import os

openai_api_key = os.getenv("OPENAI_API_KEY")

client = OpenAI(openai_api_key)

from utils.embeddings_utils import get_embedding 

embedding_model = "text-embedding-ada-002"
embedding_encoding = "cl100k_base"
max_tokens= 8000


input_datapath = "assets/Reviews.csv"
df = pd.read_csv(input_datapath, index_col=0)
df = df[["Time", "ProductId", "UserId", "Score", "Summary", "Text"]]
df = df.dropna()
df["combined"] = (
    "Title: " + df.Summary.str.strip() + "; Content: " + df.Text.str.strip()
)

df.head(2)

top_n = 1000
df = df.sort_values("Time").tail(top_n * 2)  
df.drop("Time", axis=1, inplace=True)

encoding = tiktoken.get_encoding(embedding_encoding)

df["n_tokens"] = df.combined.apply(lambda x: len(encoding.encode(x)))
df = df[df.n_tokens <= max_tokens].tail(top_n)
len(df)

# Ensure you have your API key set in your environment per the README: https://github.com/openai/openai-python#usage

# This may take a few minutes
df["embedding"] = df.combined.apply(lambda x: get_embedding(x, model=embedding_model))
df.to_csv("assets/Reviews_with_embeddings_1k.csv")