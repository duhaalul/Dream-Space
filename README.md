# Dream Space

**Sistem Informasi Kasir dan Antrean untuk Studio Foto Dream Space Padang.**

Proyek ini dikembangkan sebagai tugas mata kuliah **Manajemen Proyek Sistem Informasi (MPSI)**. Sistem membantu operasional studio, mulai dari pencatatan reservasi dan pelanggan datang langsung, pengaturan antrean foto, pembayaran, hingga laporan untuk pemilik usaha.

Reservasi pelanggan tetap dilakukan melalui WhatsApp, kemudian dicatat oleh Admin ke dalam sistem. Pelanggan tidak memerlukan akun aplikasi.

## Tujuan

- Memusatkan pencatatan kunjungan, layanan, dan pembayaran.
- Mengatur antrean setiap paket atau ruang studio.
- Menghitung tagihan paket dan layanan tambahan secara konsisten.
- Menyediakan riwayat transaksi dan laporan untuk Owner.

## Pengguna Sistem

| Pengguna | Tanggung jawab |
| --- | --- |
| **Admin** | Mendaftarkan pelanggan datang langsung beserta tambahan layanan, menerima pembayaran, mencetak nota, dan mengelola antrean. |
| **Owner** | Mengelola paket, harga, latar, dan layanan tambahan; memantau antrean dan transaksi; melihat dashboard, mengekspor laporan, serta mereset kata sandi Admin. |

Sistem menggunakan dua akun tetap: satu akun Admin bersama dan satu akun Owner.

## Fitur Utama

| Modul | Fitur |
| --- | --- |
| **Paket dan Harga** | Pengelolaan paket, kode antrean, pilihan latar, kapasitas orang, harga, dan tambahan layanan. |
| **Pendaftaran dan Pembayaran** | Pendaftaran datang langsung sekaligus pembayaran lunas (tunai/transfer/QRIS, kembalian tunai), tambahan layanan dipilih saat mendaftar. |
| **Antrean** | Antrean per paket: panggil, lewati, kembalikan, mulai foto, selesai, batalkan, tutup/buka ruangan sementara, timer sesi foto dengan notifikasi waktu habis, serta penutupan otomatis kunjungan hari sebelumnya. |
| **Nota dan Riwayat** | Nota PDF setelah lunas (nomor antrean di atas), cetak ulang nota, serta riwayat sesi selesai dan dibatalkan. |
| **Dashboard dan Laporan** | Ringkasan penjualan (dihitung saat lunas), kinerja paket, dan arus kas, dengan ekspor PDF dan Excel. |
| **Akun dan Keamanan** | Login, pembatasan hak akses, perubahan kata sandi, pencabutan sesi, dan batas sesi tidak aktif. |

## Alur Operasional

Alur pelanggan datang langsung:

1. Di menu **Pendaftaran**, Admin mencatat nama panggilan, paket, latar, jumlah orang, dan tambahan layanan (tambah waktu/cetak).
2. Pelanggan **membayar lunas** saat itu juga. Admin menekan **Konfirmasi & Masuk Antrean**; muncul pop-up nomor antrean dan tombol **Cetak Nota** (nomor antrean ada di atas nota).
3. Pelanggan menunggu di antrean paketnya. Admin memanggil, lalu memulai foto; timer berjalan sesuai durasi paket + tambah waktu, dan notifikasi muncul saat waktu habis.
4. Setelah sesi foto, Admin menekan **Selesai**. Sesi masuk **Riwayat**.

**Contoh:** paket Rp100.000 + tambah waktu Rp20.000 → dibayar Rp120.000 saat mendaftar → masuk antrean → foto → selesai.

Setelah lunas, paket dan tambahan tidak bisa diubah. Pembatalan hanya sebelum foto dimulai; uang yang sudah dibayar tidak dikembalikan. Kunjungan yang belum ditutup sampai ganti hari ditutup otomatis oleh sistem.

## Teknologi

### Backend

| Komponen | Teknologi |
| --- | --- |
| Bahasa | TypeScript dengan mode strict |
| Runtime dan API | Node.js dan Express |
| Database | MySQL melalui mysql2, tanpa ORM |
| Validasi | Zod |
| Autentikasi | bcrypt, JWT, dan sesi tersimpan di database |
| Nota dan laporan PDF | pdfmake |
| Ekspor Excel | ExcelJS |
| Pengujian | Node.js Test Runner dan Supertest |
| CI | GitHub Actions (workflow masih di branch `backend-dream-space`, belum dipindah ke `main`) |

### Frontend

| Komponen | Teknologi |
| --- | --- |
| Bahasa | JavaScript (JSX) |
| Library antarmuka | React 19 |
| Build dan server pengembangan | Vite 8 |
| Navigasi halaman | React Router 7 |
| Tampilan (styling) | Tailwind CSS 4 |
| Grafik dashboard dan laporan | Recharts |
| Ikon | lucide-react |
| Font | Poppins dan Fraunces |
| Pemeriksaan kode | oxlint |
| Komunikasi ke backend | `fetch` dengan token Bearer ([`shared/api/client.js`](frontend/src/shared/api/client.js)) |

## Struktur Repositori

```text
Dream-Space/
├── backend/                 API Express + MySQL
│   ├── src/                 kode server (auth, katalog, antrean, kasir, laporan)
│   ├── migrations/          struktur tabel database
│   └── docs/                kontrak API, ERD, panduan operasional
└── frontend/                aplikasi web React
    └── src/
        ├── app/             rute, menu samping, proteksi login per peran
        ├── modules/         satu folder per modul, masing-masing dengan README
        │   ├── akun/        login, profil, ganti & reset kata sandi
        │   ├── paket/       paket, latar, tambahan layanan, tutup/buka ruangan
        │   ├── antrean/     papan antrean, detail kunjungan
        │   ├── kasir/       pendaftaran + pembayaran, nota, riwayat
        │   └── laporan/     dashboard dan laporan Owner
        └── shared/          komponen dasar, koneksi API, format Rupiah/tanggal
```

## Cara Menjalankan Aplikasi

Panduan menjalankan aplikasi lengkap (backend + frontend) di laptop sendiri, misalnya untuk mencoba atau menguji. Setiap laptop memakai database MySQL sendiri, jadi data antar laptop **tidak** saling terhubung.

### 1. Persiapan

| Perlu | Keterangan |
| --- | --- |
| [Git](https://git-scm.com/) | Untuk mengambil kode. |
| [Node.js](https://nodejs.org/) 24 (atau 22) | Backend meminta Node 24; Node 22 tetap jalan, hanya muncul peringatan versi saat `npm ci`. |
| [Laragon](https://laragon.org/) | Untuk MySQL 8 (minimal 8.0.16). |

### 2. Ambil kode

```bash
git clone https://github.com/duhaalul/Dream-Space.git
cd Dream-Space
```

Sudah pernah clone? Cukup perbarui: `git checkout main` lalu `git pull origin main`.

### 3. Buat database

Buka Laragon → **Start All**. Lalu buka **Database** (HeidiSQL/phpMyAdmin) atau **Terminal** → `mysql -u root`, dan jalankan (ganti `SandiDatabaseAnda`):

```sql
CREATE DATABASE dream_space CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'dream_space'@'localhost' IDENTIFIED BY 'SandiDatabaseAnda';
CREATE USER 'dream_space'@'127.0.0.1' IDENTIFIED BY 'SandiDatabaseAnda';
GRANT ALL PRIVILEGES ON dream_space.* TO 'dream_space'@'localhost';
GRANT ALL PRIVILEGES ON dream_space.* TO 'dream_space'@'127.0.0.1';
```

### 4. Jalankan backend (terminal 1)

```bash
cd backend
npm ci
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Buka `backend/.env`, lalu isi:

| Isian | Diisi dengan |
| --- | --- |
| `DB_PASSWORD` | Sandi database dari langkah 3. |
| `JWT_SECRET` | Teks acak minimal 32 karakter. Buat dengan: `node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"` |
| `SEED_ADMIN_PASSWORD`, `SEED_OWNER_PASSWORD` | Sandi awal akun `admin` dan `owner`, minimal 12 karakter. Catat; dipakai untuk login pertama. |

Isian lain (`PORT=3000`, `FRONTEND_ORIGIN=http://localhost:5173`, `DB_NAME`, `DB_USER`) biarkan seperti contoh. Lalu:

```bash
npm run db:migrate    # membuat/memperbarui tabel
npm run db:seed       # membuat akun admin & owner (sekali saja)
npm run dev
```

Cek di browser: http://localhost:3000/health/ready harus menampilkan `{"status":"ok","database":"connected"}`.

### 5. Jalankan frontend (terminal 2)

```bash
cd frontend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm ci
npm run dev
```

Buka **http://localhost:5173**. Biarkan kedua terminal tetap terbuka selama memakai aplikasi; tekan `Ctrl + C` untuk mematikan.

### 6. Login pertama

1. Login sebagai `owner` dengan sandi `SEED_OWNER_PASSWORD`. Sistem meminta **ganti kata sandi** dulu (minimal 12 karakter), lalu login lagi dengan sandi baru.
2. Lakukan hal yang sama untuk `admin` dengan `SEED_ADMIN_PASSWORD`.
3. Sebagai Owner, buka **Kelola Paket**: buat tambahan layanan, paket, dan latarnya. Setelah ada paket, Admin bisa mencoba Pendaftaran, Antrean, dan Riwayat.

### 7. Menjalankan lagi di hari lain

Laragon → **Start All**, lalu `npm run dev` di folder `backend`, kemudian `npm run dev` di folder `frontend`. Seed **tidak** perlu diulang.

Setelah `git pull`, jalankan `npm ci` lalu `npm run db:migrate` di folder `backend` (aman diulang; hanya menjalankan migrasi baru), dan `npm ci` di folder `frontend`.

<details>
<summary><strong>Masalah umum</strong></summary>

- **`npm run dev` gagal karena port 3000 atau 5173 sudah dipakai**: server lain masih berjalan. Tutup terminal lama atau matikan dengan `Ctrl + C`.
- **"Terlalu banyak percobaan login"**: backend membatasi 20 percobaan login per 15 menit per komputer. Tunggu sampai 15 menit, lalu coba lagi.
- **Admin lupa kata sandi**: Owner mereset kata sandi Admin di halaman **Profil**; Admin wajib menggantinya saat login berikutnya.
- **Owner lupa kata sandi / ingin mulai dari awal**: kosongkan database `dream_space` (hapus lalu buat lagi seperti langkah 3), lalu ulangi `npm run db:migrate` dan `npm run db:seed`. Semua data di laptop tersebut ikut terhapus.
- **Health check tidak `connected`**: periksa Laragon sudah Start All dan isian `DB_*` di `backend/.env`.
- **Jangan** mengirim file `.env` ke GitHub atau grup; isinya sandi.

</details>

## Status Pengembangan

Backend dan frontend sudah berada di branch `main`, masing-masing di folder [`backend/`](backend/) dan [`frontend/`](frontend/).

| Bagian | Pengembang | Status |
| --- | --- | --- |
| Backend: migrasi, autentikasi, katalog, antrean, kasir, laporan, backup | Duha | Selesai; unit & integration test lulus |
| Frontend: menu, komponen dasar, Login | Ihsan | Selesai |
| Frontend: Pendaftaran (tab Di Tempat & Reservasi: DP/lunas, nota) dan Riwayat | Ihsan | Selesai |
| Frontend: Antrean (per paket, bagian Reservasi + Ubah Reservasi + Sudah Datang, detail kunjungan) | Ihsan | Selesai |
| Frontend: Paket/Kelola Paket, Dashboard, Laporan, Profil | Larisa | Selesai |

Tahap berikutnya: uji integrasi tim, UAT di studio, pengujian printer nota, dan deployment.

Batasan yang diketahui (rincian di README modul [antrean](frontend/src/modules/antrean/README.md) dan [kasir](frontend/src/modules/kasir/README.md)):
- **Koreksi transaksi** setelah pelanggan masuk antrean (mis. ganti paket, salah metode bayar) belum tersedia; akan ditambahkan kemudian.
- Laporan tinggal L-01 Penjualan dan L-02 Penjualan per Paket, berupa **buku kas**: uang masuk per pembayaran (DP / Lunas) pada hari bayar dan **Refund** (baris minus) pada hari pengembalian; Admin bisa melihat laporan hari ini. L-03 Penerimaan Uang dan L-04 Rekap Kunjungan dihapus.
- Reservasi wajib memilih paket; jam reservasi di paket yang sama tidak boleh bentrok (durasi paket + tambah waktu).
- Reservasi bisa diubah sebelum datang (paket, tambahan, jadwal): lebih mahal → sisa dibayar saat datang; lebih murah dari yang sudah dibayar → kelebihan dikembalikan. Batal tidak mengembalikan uang (DP maupun lunas).

## Dokumentasi dan Mulai Pengembangan

- [Panduan operasional backend: database, akun, backup](backend/docs/OPERATIONS.md)
- [Kontrak API untuk integrasi frontend](backend/docs/API.md)
- [Arsitektur dan pemetaan kebutuhan sistem](backend/docs/ARCHITECTURE.md)
- [ERD Revisi 05](backend/docs/ERD_Revisi_05.md)
- [Diagram ERD Mermaid](backend/docs/erd.mmd)
- [Klarifikasi pembayaran sebelum mulai foto](backend/docs/PAYMENT_RULE_CHANGE.md)
- [Catatan integrasi frontend–backend](backend/docs/FRONTEND_INTEGRATION.md)
- [README backend](backend/README.md): perintah pengujian dan build.
- [README frontend](frontend/README.md): pembagian kerja tim, aturan Git, komponen dasar, dan pegangan tiap modul.

Kredensial lokal (`.env`) dan data database tidak disimpan di repositori.

## Batas Lingkup

Proyek ini tidak mencakup pemesanan mandiri oleh pelanggan, integrasi otomatis WhatsApp atau payment gateway, pengendalian kamera, penyimpanan hasil foto, promo/voucher, dan sistem akuntansi.

Acuan pengembangan adalah SRS Dream Space tanggal **10 November 2026**, ERD Revisi 05, serta klarifikasi pembayaran tanggal **11 November 2026**.
