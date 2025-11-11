import re
import json
import os
from collections import defaultdict

def process_chat_history(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        lines = file.readlines()

    conversations = []
    pattern = re.compile(r"(\d{2}/\d{2}/\d{2} \d{2}.\d{2}) - ([^:]+): (.+)")
    
    temp_convo = defaultdict(str)
    customer = None
    cs = None

    ignore_keywords = ["invoice", "INV-", "(file terlampir)", "Pemberitahuan Layanan Internet", "gangguan layanan internet", "*Konfirmasi Registrasi Pelanggan*", "*Terima kasih atas pembayaran anda*"]

    for line in lines:
        match = pattern.match(line)
        if match:
            timestamp, sender, message = match.groups()

            if any(keyword.lower() in message.lower() for keyword in ignore_keywords):
                continue

            if "CUSTOMER SERVICE" in sender.upper():
                cs = sender
            else:
                customer = sender

            if customer and cs:
                if sender == customer:
                    temp_convo["customer"] += message + " "
                elif sender == cs:
                    temp_convo["cs"] += message + " "

            if temp_convo["customer"] and temp_convo["cs"]:
                conversations.append({
                    "customer": temp_convo["customer"].strip(),
                    "cs": temp_convo["cs"].strip()
                })
                temp_convo = defaultdict(str) 
    
    return conversations

def get_sorted_chat_files(folder_path):
    chat_folders = [f for f in os.listdir(folder_path) if f.startswith("Chat-")]
    
    chat_folders.sort(key=lambda x: int(re.search(r"\d+", x).group()))
    
    return [os.path.join(folder_path, f, f"{f}.txt") for f in chat_folders]

def process_multiple_files(folder_path, output_file):
    all_conversations = []

    chat_files = get_sorted_chat_files(folder_path)

    for file_path in chat_files:
        if os.path.exists(file_path):
            print(f"📂 Memproses: {file_path}")
            conversations = process_chat_history(file_path)
            all_conversations.extend(conversations)
        else:
            print(f"⚠️ File tidak ditemukan: {file_path}")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_conversations, f, ensure_ascii=False, indent=4)

    print(f"✅ Semua data berhasil diproses dan disimpan ke {output_file}")

folder_path = "./Data"
output_file = "retrieval_data.json"

process_multiple_files(folder_path, output_file)