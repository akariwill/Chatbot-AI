import json

def load_data(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not data:
                print(f"[WARNING] File {filepath} kosong atau gagal dibaca.")
            return data
    except Exception as e:
        print(f"❌ Gagal membaca file {filepath}: {e}")
        return []
