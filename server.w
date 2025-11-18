# Perintah untuk Menjalankan Chatbot & WhatsApp Bot

Berikut adalah langkah-langkah untuk menjalankan kedua server di dalam sesi `tmux` di server SSH Anda.

---

### Bagian 1: Menjalankan Server Chatbot (Python)

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
    *Server ini akan berjalan di port 8001.*

---

### Bagian 2: Menjalankan WhatsApp Bot (Node.js)

Agar QR code muncul, Anda **juga harus menjalankan server WhatsApp Bot**.

1.  **Buka jendela baru di dalam tmux:**
    Tekan `Ctrl+b` lalu `c`. Ini akan membuat jendela terminal baru di dalam sesi `tmux` yang sama.

2.  **Masuk ke direktori WhatsApp Bot:**
    ```bash
    cd /path/to/your/project/whatsapp-bot
    ```
    *(Sesuaikan path jika perlu)*

3.  **Install dependencies Node.js:**
    ```bash
    npm install
    ```

4.  **Jalankan WhatsApp Bot:**
    ```bash
    node index.js
    ```
    *Server ini akan berjalan di port 3000 dan akan menghasilkan file QR code.*

---

### Mengakses Aplikasi

-   **Chatbot API** akan tersedia di `http://<IP_SERVER_ANDA>:8001`.
-   **Website WhatsApp QR Code** akan tersedia di `http://<IP_SERVER_ANDA>:3000`.

Anda dapat berpindah antar jendela di `tmux` dengan menekan `Ctrl+b` lalu `0` (untuk jendela pertama) atau `Ctrl+b` lalu `1` (untuk jendela kedua).

Untuk keluar dari sesi SSH tanpa mematikan server, tekan `Ctrl+b` lalu `d`.

---

### Troubleshooting: Masalah Koneksi Setelah Scan QR

Jika Anda mengalami error koneksi setelah scan QR (bot mencoba menyambung ulang terus-menerus), coba langkah berikut:

1.  **Hentikan server WhatsApp Bot** (tekan `Ctrl+c` di jendela tmux-nya).
2.  **Hapus folder `auth_info`** yang ada di dalam direktori `whatsapp-bot`. Folder ini menyimpan sesi login Anda. Menghapusnya akan memaksa Anda untuk scan QR baru, dan seringkali ini menyelesaikan masalah koneksi.
    ```bash
    rm -rf /path/to/your/project/whatsapp-bot/auth_info
    ```
3.  **Jalankan kembali server WhatsApp Bot** dengan `node index.js`. Anda akan diminta untuk scan QR code yang baru.
