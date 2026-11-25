# Laporan Audit Keamanan DARFIN BOOK (Cloudflare Security Audit Framework)

Laporan audit keamanan komprehensif ini disusun berdasarkan metodologi dan kerangka kerja resmi **Cloudflare Security Audit Skill** (`https://github.com/cloudflare/security-audit-skill`).

---

## 1. Ringkasan Eksekutif (Executive Summary)

Audit keamanan menyeluruh dilakukan terhadap seluruh komponen aplikasi DARFIN BOOK:
- **Backend API & Providers** (Node.js / Fastify / SQLite)
- **Frontend SPA** (React 19 / Vite / Tailwind)
- **Mobile Hybrid Container** (Capacitor / Android WebView / Java Bridge)

Seluruh 11 kerentanan yang teridentifikasi telah diperbaiki secara tuntas (100% remediated) tanpa merusak fungsionalitas aplikasi.

---

## 2. Model Ancaman (Threat Modeling)

- **Aset Kritis**: Data rak pengguna, token sesi HMAC, token Google OAuth, ketersediaan backend (Render), integritas tampilan bacaan.
- **Titik Masuk (Entrypoints)**:
  - Endpoint publik: `/api/v1/auth/*`, `/api/v1/search`, `/api/v1/reader/resolve`, `/api/v1/wikisource/content/:pageId`.
  - Android Intent & Deep Links: Custom URL scheme `darfinbook://auth?token=...`.
  - Browser IPC: `window.postMessage` antara WebView container dan SPA.
  - Data eksternal: Scraped HTML dari Wikisource & API metadata Internet Archive.

---

## 3. Daftar Temuan & Bukti Perbaikan (Findings & Remediations)

| ID | Kerentanan | Tingkat Keparahan | Status | File Terdampak |
|---|---|---|---|---|
| **SEC-001** | Account Takeover / Auth Bypass (CWE-287, CWE-347) | **CRITICAL** | **TUNTAS** | `src/server.ts` |
| **SEC-002** | Android WebView Intent JS Injection (CWE-94, CWE-79) | **HIGH** | **TUNTAS** | `MainActivity.java` |
| **SEC-003** | Cross-Origin PostMessage Token Poisoning (CWE-345) | **HIGH** | **TUNTAS** | `App.tsx`, `MainActivity.java` |
| **SEC-004** | Stored XSS dari Scraped Wikisource HTML (CWE-79) | **HIGH** | **TUNTAS** | `src/providers/wikisource.ts` |
| **SEC-005** | Path Traversal pada Metadata Internet Archive (CWE-22) | **HIGH** | **TUNTAS** | `src/services/readerResolver.ts` |
| **SEC-006** | Timing Attack pada Verifikasi Token HMAC (CWE-208) | **MEDIUM** | **TUNTAS** | `src/services/userService.ts` |
| **SEC-007** | Missing Rate Limiting / DoS Risk (CWE-400, CWE-770) | **MEDIUM** | **TUNTAS** | `src/server.ts` |
| **SEC-008** | Hilangnya Header Keamanan OWASP/Cloudflare (CWE-1021) | **MEDIUM** | **TUNTAS** | `src/server.ts` |
| **SEC-009** | Unrestricted External iFrame Embedding (CWE-1021) | **MEDIUM** | **TUNTAS** | `ReaderModal.tsx` |
| **SEC-010** | ADB Backup Token/Data Extraction (CWE-922, CWE-312) | **LOW** | **TUNTAS** | `AndroidManifest.xml` |
| **SEC-011** | Unbounded Search Parameters (CWE-1284) | **LOW** | **TUNTAS** | `src/server.ts` |

---

## 4. Rincian Teknis Perbaikan

### SEC-001: Verifikasi Token Resmi Google OAuth & ID Token
- **Masalah**: Endpoint `/api/v1/auth/google` sebelumnya menerima body email langsung tanpa memvalidasi tanda tangan kriptografi token Google ke server OAuth Google.
- **Perbaikan**: Mengintegrasikan verifikasi wajib ke endpoint Google:
  1. `https://oauth2.googleapis.com/tokeninfo?id_token=...` untuk Google ID Token (`credential`), memvalidasi `email_verified == true` dan `aud == GOOGLE_CLIENT_ID`.
  2. `https://www.googleapis.com/oauth2/v3/userinfo` untuk Google Access Token.
  3. Memblokir total login email tanpa token di lingkungan produksi (`production`).

### SEC-002 & SEC-003: Sanitasi Android WebView IPC & Scoped PostMessage
- **Masalah**: `MainActivity.java` menyuntikkan token langsung via konkatenasi string ke `evaluateJavascript` dan memancarkan `window.postMessage(..., '*')`.
- **Perbaikan**:
  1. Validasi regex ketat JWT `^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$`.
  2. Escape aman menggunakan `JSONObject.quote(token)`.
  3. Membatasi target `postMessage` ke `window.location.origin` (bukan `'*'`).
  4. Menambahkan pengecekan origin di `App.tsx` agar menolak pesan luar.

### SEC-004: Sanitasi HTML Wikisource (Anti-XSS)
- **Masalah**: Konten Wikisource dirender via `dangerouslySetInnerHTML`.
- **Perbaikan**: Dibuat metode `sanitizeHtml` di `WikisourceProvider` untuk membersihkan tag aktif `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, atribut event inline `on*`, serta URL skema `javascript:` dan `data:text/html`.

### SEC-005: Pencegahan Directory Traversal pada Internet Archive
- **Masalah**: Parameter `iaIdentifier` dan nama file scandata tidak divalidasi ketat.
- **Perbaikan**: Ditambahkan validasi regex karakter `^[a-zA-Z0-9_.-]+$` dan blokade `..` serta pemisah direktori `/` dan `\`.

### SEC-006: Pencegahan Timing Attack (Constant-Time HMAC)
- **Masalah**: Perbandingan signature token sesi menggunakan operator perbandingan string `===`.
- **Perbaikan**: Menggunakan `crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))`.

### SEC-007 & SEC-008: Rate Limiting & Header Keamanan Fastify
- **Masalah**: Tidak ada batas frekuensi request pada endpoint autentikasi dan ketiadaan header proteksi browser.
- **Perbaikan**:
  - Rate limiting in-memory: 20 req/menit untuk auth, 60 req/menit untuk search. Mengembalikan kode `429 Too Many Requests` dan header `Retry-After`.
  - Header keamanan: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, dan `Strict-Transport-Security` di lingkungan produksi.

### SEC-009: Sandboxing iFrame Pembaca Eksternal
- **Masalah**: iFrame pembaca buku eksternal tidak memiliki atribut `sandbox` dan validasi protokol URL.
- **Perbaikan**: Validasi skema `http:` / `https:` dan penambahan `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`.

### SEC-010: Pencegahan Pencurian Data via ADB Backup
- **Masalah**: `android:allowBackup="true"` memungkinkan backup offline data aplikasi via kabel USB.
- **Perbaikan**: Mengubah `android:allowBackup="false"` di `AndroidManifest.xml`.

---

## 5. Hasil Verifikasi & Pengujian

- **Unit & Integration Tests**: 19 dari 19 pengujian lulus (`vitest run`).
- **Build Client**: Vite production bundle sukses tanpa error.
- **Build Server**: TypeScript compilation (`tsc`) bersih tanpa error.
- **Capacitor Sync**: Aset web disinkronkan ke direktori Android.
