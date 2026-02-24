import os
import sys

try:
    import fitz
except ImportError:
    print("Instal PyMuPDF dulu: pip install pymupdf")
    sys.exit(1)

PDF_PATH = "Research.pdf"
OUT_DIR = "website/img/research"

PAGES = [
    (31, "gambar-3-1-arsitektur-rag.png"),       # Gambar 3.1 Arsitektur RAG
    (32, "gambar-3-2-arsitektur-langchain.png"), # Gambar 3.2 Arsitektur LangChain
    (44, "gambar-3-3-flowchart-berjalan.png"),   # Gambar 3.3 Flowchart sistem berjalan
    (46, "gambar-3-4-flowchart-diusulkan.png"),  # Gambar 3.4 Flowchart sistem diusulkan
    (52, "gambar-4-1-perancangan-sistem.png"),   # Gambar 4.1 Perancangan sistem
    (54, "gambar-4-2-data-pipeline.png"),        # Gambar 4.2 Data pipeline
    (56, "gambar-4-3-conversation-memory.png"),  # Gambar 4.3 Conversation Buffer Window Memory
]

def main():
    if not os.path.exists(PDF_PATH):
        print(f"File tidak ditemukan: {PDF_PATH}")
        sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)
    total = len(doc)
    print(f"PDF punya {total} halaman (indeks 0–{total-1}).")
    for page_idx, filename in PAGES:
        if page_idx < 0 or page_idx >= total:
            print(f"Lewati halaman {page_idx} (di luar rentang).")
            continue
        page = doc[page_idx]
        pix = page.get_pixmap(dpi=150, alpha=False)
        out_path = os.path.join(OUT_DIR, filename)
        pix.save(out_path)
        print(f"Simpan: {out_path} (halaman {page_idx + 1})")
    doc.close()
    print("Selesai.")

if __name__ == "__main__":
    main()
