# agents/agent_router.py

def agent_response(user_input: str) -> str | None:
    """
    Routing pertanyaan ke skill agent yang sesuai.
    Jika tidak ada yang cocok, kembalikan None agar bisa diteruskan ke retrieval QA biasa.
    """

    lower_input = user_input.lower()

    if "jadwal teknisi" in lower_input or "kapan teknisi" in lower_input:
        return handle_teknisi_jadwal(user_input)

    elif "hubungi teknisi" in lower_input or "nomor teknisi" in lower_input:
        return handle_teknisi_kontak(user_input)

    elif "sewa alat" in lower_input or "pinjam alat" in lower_input:
        return handle_sewa_alat(user_input)

    elif "cek tagihan" in lower_input or "bayar wifi" in lower_input:
        return handle_tagihan(user_input)

    # Tambahkan routing lain sesuai kebutuhan

    return None  # fallback ke retriever


# ===== Skill Handler =====

def handle_teknisi_jadwal(user_input: str) -> str:
    return (
        "Teknisi kami tersedia setiap hari Senin - Sabtu pukul 09.00 - 17.00.\n"
        "Jika Anda ingin menjadwalkan kunjungan teknisi, silakan beri tahu waktu yang Anda inginkan 😊"
    )

def handle_teknisi_kontak(user_input: str) -> str:
    return (
        "Anda dapat menghubungi teknisi kami melalui WhatsApp di nomor 0812-3456-7890.\n"
        "Kami siap membantu jika ada gangguan atau pemasangan baru."
    )

def handle_sewa_alat(user_input: str) -> str:
    return (
        "Kami menyediakan sewa alat seperti:\n"
        "- Router tambahan: Rp 25.000/bulan\n"
        "- Repeater sinyal: Rp 30.000/bulan\n"
        "Ingin sewa alat tertentu? Saya bisa bantu prosesnya."
    )

def handle_tagihan(user_input: str) -> str:
    return (
        "Untuk cek tagihan, Anda bisa kirim pesan:\n"
        "`Cek tagihan [Nama Pelanggan]`\n"
        "Contoh: `Cek tagihan Budi Santoso`\n"
        "Atau Anda ingin saya bantu cek sekarang?"
    )
