# Dream Space

Backend sistem kasir dan antrean Dream Space Padang, mengacu pada **SRS-DS-001 tanggal 10 November 2026** (`SRS_Dream_Space..docx`), ERD Revisi 04, dan klarifikasi 11 November 2026: **tagihan awal wajib lunas sebelum mulai foto; tambahan selama sesi dibayar di akhir**. Frontend belum termasuk implementasi ini.

## Struktur

```text
backend/
  src/           API, aturan bisnis, autentikasi, laporan
  migrations/    skema MySQL
  test/          unit dan integrasi MySQL
docs/
  API.md         kontrak dan contoh alur frontend
  ARCHITECTURE.md keputusan teknis dan pemetaan SRS
  OPERATIONS.md  setup, akun, backup, dan pemulihan
  erd.mmd        ERD implementasi
```

## Menjalankan

Prasyarat: **Node.js 24** dan **MySQL 8.0.16+** (CHECK constraint harus benar-benar ditegakkan).

```powershell
cd backend
npm ci
Copy-Item .env.example .env
# Isi koneksi MySQL, JWT_SECRET acak, dan dua SEED_*_PASSWORD (minimal 12 karakter).
# Buat database dan user MySQL terlebih dahulu; lihat docs/OPERATIONS.md.
npm run db:migrate
npm run db:seed
npm run dev
```

API: `http://localhost:3000`; frontend yang diizinkan secara default: `http://localhost:5173`.

Username awal `admin` dan `owner`. Password diambil dari konfigurasi lokal, tidak ada password bawaan dalam kode. Login pertama wajib mengganti password. Seed ulang tidak mengganti akun yang sudah ada. Owner mengisi paket/harga/latar/tambahan sebelum operasional.

**Untuk mesin Alul yang sudah disiapkan:** `.env`, `.env.test`, database, migrasi, dan akun sudah dibuat di folder `backend`. Tidak perlu menimpa `.env` dengan template. Database terpisah menggunakan port **13316**, tidak mengubah database Laragon port 3306. Lihat [operasi lokal](docs/OPERATIONS.md#mesin-development-yang-sudah-disiapkan).

## Pemeriksaan

```powershell
cd backend
npm run typecheck
npm run build
npm test
# Isi .env.test dari .env.test.example dengan database KHUSUS test.
npm run test:integration
```

Integration test mensyaratkan `NODE_ENV=test` dan nama database berakhiran `_test`. `TEST_RESET=1` menghapus tabel dalam **database test tersebut** sebelum pengujian. Jangan arahkan konfigurasi test ke data usaha.

Build produksi dijalankan dengan `npm start`. CI GitHub menjalankan pemeriksaan tipe, build, unit test, dan integrasi MySQL.

## Implementasi

- Dua role tetap, bcrypt, JWT + sesi server, idle 30 menit, reset password dan pencabutan sesi.
- Paket dinamis, latar, tambahan yang diizinkan, tiga rumus harga dan snapshot tarif.
- Reservasi/DP, walk-in, antrean per paket/hari, prioritas, panggil, mulai, lewati/kembali, pembatalan.
- Pembayaran tunai/transfer/QRIS, kembalian, refund kelebihan, konfirmasi akhir, koreksi dengan audit.
- Nota PDF setelah selesai; dashboard dan empat laporan dengan PDF/XLSX.
- Idempotensi pendaftaran/pembayaran/refund, versi untuk perubahan, transaksi SQL dan penguncian.

Dokumentasi utama: [API](docs/API.md), [arsitektur & cakupan SRS](docs/ARCHITECTURE.md), [operasional](docs/OPERATIONS.md).

Backend ini sudah diuji lokal, tetapi belum berarti lulus UAT studio atau sudah dideploy. Integrasi frontend, pengujian printer fisik, hosting, backup terjadwal di mesin deployment, dan uji beban lingkungan deployment tetap perlu dilakukan bersama tim.
