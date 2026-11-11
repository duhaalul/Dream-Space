# Operasional backend

## Database baru

Gunakan MySQL 8.0.16+ dan database UTF-8. Contoh untuk administrator DB (ganti password, jangan commit):

```sql
CREATE DATABASE dream_space CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'dream_space'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_ACAK';
GRANT ALL PRIVILEGES ON dream_space.* TO 'dream_space'@'localhost';
```

Grant ALL di atas untuk development/migrasi saja. Produksi pisahkan akun migrasi DDL dan akun runtime DML. Sesuaikan host sesuai jaringan deployment, jangan membuka root ke internet.

Salin `backend/.env.example` ke `.env`, isi koneksi dan rahasia, jalankan `npm run db:migrate` lalu `npm run db:seed`. Database tidak dibuat otomatis oleh migrasi. Migrasi memakai penanda `schema_migrations`, menjalankan ulang migrasi yang sukses tidak menghapus data. DDL MySQL auto-commit: jika migrasi pertama terputus di tengah, periksa tabel parsial, jangan menjalankan DROP terhadap database usaha.

`SEED_ADMIN_PASSWORD` dan `SEED_OWNER_PASSWORD` minimal 12 karakter, maksimal 72 byte UTF-8. Password di-hash bcrypt. Seed ulang tidak mereset akun. Setelah login pertama, ganti password; untuk reset berikutnya Owner memakai API reset Admin. Tidak ada endpoint tambah akun atau ubah role.

## Mesin development yang sudah disiapkan

Lokasi repositori:
`C:\Alul\Sistem Informasi UA24\Semester 5\MPSI\Backend_DreamSpace`

Backend ada di subfolder `backend` agar repositori dapat menampung frontend/dokumentasi tim. Konfigurasi lokal berikut **diabaikan Git**:

- `.env`: database development port 13316 dan password awal seed.
- `.env.test`: database khusus pengujian, reset diperbolehkan hanya di sana.
- `.local/mysql-test`: data instance MySQL lokal terpisah, berisi schema `dream_space` dan `dream_space_test`.
- `.local/mysql-admin.json`: credential administrator instance lokal, untuk pemeliharaan sendiri.

MySQL Laragon port 3306 tidak diubah. Setelah komputer restart, nyalakan instance terpisah ini dari folder `backend`:

```powershell
$dataPath = Join-Path (Get-Location) '.local\mysql-test'
Start-Process -FilePath 'C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqld.exe' `
  -ArgumentList @('--no-defaults', ('--datadir="' + $dataPath + '"'), '--port=13316', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--log-error=mysql-error.log') `
  -WindowStyle Hidden
npm run dev
```

Jangan jalankan instance kedua jika port 13316 sudah aktif. Untuk memakai Laragon biasa, buat database/user terpisah di Laragon lalu ubah `.env` dan lakukan migrasi/seed di database tujuan; jangan hanya mengganti port tanpa menyiapkan database.

Login: username `admin` atau `owner`; password awal lihat `SEED_ADMIN_PASSWORD`/`SEED_OWNER_PASSWORD` di `.env` lokal. Jangan mengirim file `.env` ke grup/GitHub. Password yang sudah diganti tidak lagi sama dengan seed.

## Pengujian dan build

```powershell
npm ci
npm run typecheck
npm test
npm run test:integration
npm run build
npm start
```

Integration test menolak konfigurasi selain `NODE_ENV=test` dan schema berakhiran `_test`. `TEST_RESET=1` mereset seluruh tabel dalam schema tersebut. Pakai user test yang hanya memiliki akses schema test, seperti konfigurasi lokal yang disediakan.

`GET /health/live` memeriksa proses; `/health/ready` memeriksa koneksi DB. Jangan menjadikan endpoint login sebagai health check.

## Backup harian

`npm run backup` memakai mysqldump dengan transaksi konsisten. Lokasi backup wajib di luar repositori. Contoh `.env` lokal:

```dotenv
MYSQLDUMP_PATH=C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqldump.exe
BACKUP_DIR=D:\Backup-Dream-Space
```

Pilih direktori yang benar-benar tersedia. Setelah konfigurasi, jalankan:

```powershell
npm run backup
```

Password tidak berada di argument proses; file konfigurasi sementara dihapus setelah selesai. Backup berisi data usaha dan hash akun: batasi izin direktori dan salin ke media/lokasi berbeda dengan perlindungan akses. Script tidak menghapus backup lama secara otomatis.

Untuk jadwal harian pada mesin deployment, jalankan build terlebih dahulu, lalu buat Task Scheduler pada jam tutup (misalnya 23:00): program `node.exe`, arguments `dist/src/backup.js`, **Start in** folder `backend`, jalankan dengan akun yang bisa membaca `.env` dan menulis tujuan backup. Aktifkan retry saat gagal dan periksa exit code/log. Jadwal belum dipasang di komputer ini karena mesin deployment, media tujuan backup, dan jam operasional produksi belum ditetapkan. Backend menyediakan script yang bisa diuji sekarang.

## Pemulihan

1. Pilih backup yang valid, siapkan schema pemulihan kosong terpisah dengan MySQL versi kompatibel.
2. Jalankan klien `mysql` menggunakan credential lokal aman dan impor file (`SOURCE C:/path/backup.sql;` dari sesi mysql).
3. Periksa jumlah tabel/kunjungan/transaksi dan konsistensi saldo, lalu jalankan aplikasi ke schema pemulihan untuk uji baca.
4. Pindahkan konfigurasi produksi hanya setelah validasi dan persetujuan operasional; jangan menimpa schema produksi saat latihan.

## Deployment dan batas yang perlu diverifikasi

Gunakan HTTPS di reverse proxy, set `FRONTEND_ORIGIN` ke origin frontend tepat, simpan rahasia di environment deployment. Konfigurasi `trust proxy` harus mengikuti topologi proxy nyata agar rate limit mengenali IP dengan benar; jangan set `true` tanpa batas secara umum. Default saat ini tidak mempercayai header proxy.

Server menggunakan satu paket = satu ruang. Pastikan keadaan studio sesuai. Uji beban untuk target SRS 3 detik operasi kasir/antrean dan 5 detik laporan setelah hosting dipilih. Uji cetak nota pada printer fisik bersama frontend. Aplikasi belum dideploy ke layanan hosting dalam pekerjaan ini.
