import tiktoken

encoding = tiktoken.get_encoding("cl100k_base")
encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
tokens = encoding.encode("Saya pasang WiFi")
print(f"Jumlah token: {len(tokens)}")
