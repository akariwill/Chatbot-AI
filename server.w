# Perintah untuk Menjalankan Chatbot Server di SSH

Berikut adalah langkah-langkah untuk menjalankan server chatbot di dalam sesi `tmux` di server SSH Anda.

1.  **Mulai sesi tmux baru:**
    ```bash
    tmux new -s chatbot
    ```

2.  **Masuk ke direktori proyek:**
    ```bash
    cd /path/to/your/project
    ```
    *(Ganti `/path/to/your/project` dengan path direktori proyek Anda)*

3.  **Buat dan aktifkan virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Jalankan server chatbot:**
    ```bash
    python3 app.py
    ```

Setelah server berjalan, Anda dapat keluar dari sesi SSH dengan menekan `Ctrl+b` lalu `d`. Sesi `tmux` akan tetap berjalan di latar belakang.

Untuk kembali ke sesi `tmux` nanti, gunakan perintah:
```bash
tmux attach -t chatbot
```
