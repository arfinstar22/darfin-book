# DARFIN BOOK 📚

**Perpustakaan Digital untuk Semua** — Platform agregator dan pembaca buku legal berbahasa Indonesia untuk Web, Telegram Mini App, Telegram Bot, dan Android.

---

## Fitur Utama

- **100% Bahasa Indonesia**: Hanya menyajikan edisi buku terverifikasi berbahasa Indonesia.
- **Koleksi Buku Terbuka & Gratis**:
  - **Buku Pelajaran Resmi**: Buku teks Kurikulum Merdeka (SD, SMP, SMA/SMK) dari SIBI Kemendikbudristek.
  - **Sastra Klasik & Cerita Rakyat**: Naskah domain publik dari Wikisumber Indonesia.
  - **Buku Bebas & Peminjaman Digital**: 136.000+ buku bahasa Indonesia dari Open Library / Internet Archive.
  - **Google Buku**: Pratinjau dan buku domain publik.
- **In-App Reader Nyaman**: Mode Kertas (Paper), Sepia, dan Malam (Dark), ukuran teks dinamis, dan tipografi ramah baca.
- **Rak Saya**: Simpan buku favorit dan riwayat baca lokal tanpa perlu login.
- **Multi-Platform**: Arsitektur tunggal untuk Web, Telegram Bot, Telegram Mini App, dan Android APK.

---

## Menjalankan Secara Lokal

```bash
# 1. Pasang dependensi
pnpm install

# 2. Jalankan pengujian
pnpm test

# 3. Mode Pengembangan
# Terminal 1: Backend Fastify API (port 4000)
pnpm dev

# Terminal 2: Frontend Vite (port 3000)
pnpm dev:web
```

Buka peramban di `http://localhost:3000`.

---

## Deploy ke Render.com (1-Click Blueprint)

Proyek ini telah dilengkapi dengan `render.yaml` (Render Blueprint):

1. Unggah kode repositori ke GitHub / GitLab Anda.
2. Buka dashboard [Render.com](https://dashboard.render.com).
3. Klik **New +** > **Blueprint**.
4. Hubungkan repositori Anda. Render akan otomatis mendeteksi konfigurasi dari `render.yaml`.
5. Klik **Apply**. Web service akan otomatis di-build dan siap diakses dengan HTTPS gratis!
