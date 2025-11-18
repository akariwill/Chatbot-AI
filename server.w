# 🚀 **Panduan Menjalankan Aplikasi dengan PM2 & Ecosystem File**

Dokumen ini menjelaskan cara menjalankan **server chatbot (Python)** dan **WhatsApp bot (Node.js)** menggunakan file konfigurasi `ecosystem.config.js` untuk manajemen yang lebih mudah dan rapi.

---

# ✅ Langkah 1: Konfigurasi Awal (Hanya dilakukan sekali)

### 1. Edit File `ecosystem.config.js`
Buka file `ecosystem.config.js` yang ada di direktori utama proyek Anda. **Anda wajib mengubah** baris `cwd` (current working directory) agar sesuai dengan path absolut (path lengkap) ke direktori proyek Anda di server.

Contoh:
```javascript
// ...
cwd: '/home/noc/chatbot/', // <-- GANTI DENGAN PATH PROYEK ANDA
// ...
cwd: '/home/noc/chatbot/whatsapp-bot/', // <-- GANTI DENGAN PATH PROYEK ANDA
// ...
```

### 2. Install Dependencies
Pastikan semua dependensi untuk kedua aplikasi sudah ter-install.

**Untuk Server Python:**
```bash
cd /path/to/your/project
python3 -m venv venv # Buat virtual env jika belum ada
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

**Untuk WhatsApp Bot:**
```bash
cd /path/to/your/project/whatsapp-bot
npm install
```

---

# ✅ Langkah 2: Menjalankan Aplikasi

### 1. Hapus Proses PM2 Lama & Sesi WhatsApp (PENTING untuk memulai dari awal)
Dari direktori utama proyek Anda, jalankan:
```bash
# Hentikan dan hapus semua proses yang di-manage PM2
pm2 delete all

# Hapus folder sesi WhatsApp yang lama/rusak
rm -rf ./whatsapp-bot/auth_info
```

### 2. Mulai Semua Aplikasi dengan Satu Perintah
Dari direktori utama proyek Anda (tempat `ecosystem.config.js` berada), jalankan:
```bash
pm2 start ecosystem.config.js
```
PM2 akan secara otomatis menjalankan kedua aplikasi (`chatbot` dan `whatsapp-bot`) sesuai konfigurasi.

### 3. Lihat Log untuk Scan QR
Untuk melihat log dari bot WhatsApp dan men-scan QR code, jalankan:
```bash
pm2 logs whatsapp-bot
```
*(Tekan `Ctrl+c` untuk keluar dari tampilan log)*

---

# ♻️ **Auto-start Setelah Reboot (WAJIB)**

Agar kedua aplikasi otomatis berjalan setelah server reboot:
```bash
# Simpan konfigurasi proses dari ecosystem file
pm2 save

# Buat skrip startup untuk server Anda
pm2 startup
```
*(Ikuti instruksi yang muncul di layar untuk perintah `startup`)*

---

# 🧹 Perintah Berguna untuk PM2

| Keperluan        | Perintah                               |
| ------------------ | -------------------------------------- |
| Lihat status semua | `pm2 ls`                               |
| Lihat log spesifik | `pm2 logs chatbot` atau `pm2 logs whatsapp-bot` |
| Restart aplikasi   | `pm2 restart chatbot` atau `pm2 restart whatsapp-bot` |
| Stop aplikasi      | `pm2 stop all` atau `pm2 stop chatbot` |
| Hapus semua        | `pm2 delete all`                       |
