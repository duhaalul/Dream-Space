# Dream Space

**Sistem Informasi Kasir dan Antrean untuk Studio Foto Dream Space Padang.**

Proyek ini dikembangkan sebagai tugas mata kuliah **Manajemen Proyek Sistem Informasi (MPSI)**. Sistem membantu operasional studio, mulai dari pencatatan reservasi dan pelanggan datang langsung, pengaturan antrean foto, pembayaran, hingga laporan untuk pemilik usaha.

Reservasi pelanggan tetap dilakukan melalui WhatsApp, kemudian dicatat oleh Admin ke dalam sistem. Pelanggan tidak memerlukan akun aplikasi.

## Tujuan

- Memusatkan pencatatan kunjungan, layanan, dan pembayaran.
- Mengatur antrean setiap paket atau ruang studio.
- Menghitung tagihan paket dan layanan tambahan secara konsisten.
- Menyediakan riwayat transaksi dan laporan untuk Owner.
- Mencatat perubahan penting agar koreksi transaksi dapat ditelusuri.

## Pengguna Sistem

| Pengguna | Tanggung jawab |
| --- | --- |
| **Admin** | Mencatat reservasi dan walk-in, mengelola antrean, menerima pembayaran, mencatat tambahan layanan, melakukan koreksi dan refund kelebihan bayar, serta mencetak nota. |
| **Owner** | Mengelola paket, harga, latar, dan layanan tambahan; memantau antrean dan transaksi; melihat dashboard, mengekspor laporan, serta mereset kata sandi Admin. |

Sistem menggunakan dua akun tetap: satu akun Admin bersama dan satu akun Owner.

## Fitur Utama

| Modul | Fitur |
| --- | --- |
| **Paket dan Harga** | Pengelolaan paket, kode antrean, pilihan latar, kapasitas orang, harga, dan tambahan layanan. |
| **Reservasi dan Antrean** | Reservasi WhatsApp, pendaftaran walk-in, konfirmasi kedatangan, prioritas reservasi, panggil, lewati, kembali, mulai, dan selesai. |
| **Kasir dan Pembayaran** | DP reservasi, pembayaran tunai/transfer/QRIS, kembalian tunai, tambahan layanan, refund kelebihan bayar, dan koreksi dengan riwayat audit. |
| **Nota dan Riwayat** | Nota PDF setelah sesi selesai, cetak ulang nota, serta riwayat transaksi selesai dan dibatalkan. |
| **Dashboard dan Laporan** | Ringkasan penjualan, kinerja paket, arus kas, dan kunjungan, dengan ekspor PDF dan Excel. |
| **Akun dan Keamanan** | Login, pembatasan hak akses, perubahan kata sandi, pencabutan sesi, dan batas sesi tidak aktif. |

## Alur Operasional

1. Admin mencatat reservasi atau pelanggan yang datang langsung.
2. Pelanggan memilih paket, latar jika tersedia, dan jumlah orang.
3. Pelanggan masuk antrean sesuai paketnya; reservasi mendapat nomor setelah kedatangan dikonfirmasi.
4. Admin memanggil pelanggan. **Seluruh tagihan yang sudah tercatat harus lunas sebelum foto dimulai.**
5. Tambahan selama sesi, seperti tambah waktu atau cetak, dicatat sebagai tambahan tagihan dan boleh dibayar di akhir.
6. Setelah seluruh tagihan akhir lunas, Admin menyelesaikan sesi dan mencetak nota.

**Contoh:** paket Rp100.000 dibayar sebelum foto → pelanggan menambah layanan Rp20.000 saat sesi → tambahan Rp20.000 dibayar di akhir → sesi selesai dan nota tersedia.

DP belum dianggap cukup untuk memulai foto jika masih ada sisa tagihan. Pembatalan hanya dapat dilakukan sebelum foto dimulai; pembayaran yang sudah diterima ditahan sesuai aturan usaha. Refund digunakan untuk kelebihan bayar.

## Teknologi Backend

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
| CI | GitHub Actions |

## Status Pengembangan

Implementasi backend tersedia pada branch **[`backend-dream-space`](https://github.com/duhaalul/Dream-Space/tree/backend-dream-space)** dan diajukan melalui **[Draft PR #2 — Backend Dream Space](https://github.com/duhaalul/Dream-Space/pull/2)**.

Backend mencakup migrasi database, autentikasi, katalog, antrean, kasir, laporan, pengujian, serta script backup. Pemeriksaan lokal dan CI sebelumnya berhasil, termasuk 2 unit test dan 13 integration test.

Integrasi frontend, UAT studio, pengujian printer fisik, dan deployment masih menjadi tahap berikutnya. README ini menjelaskan proyek; kode backend belum digabungkan ke branch `main`.

## Dokumentasi dan Mulai Pengembangan

- [Panduan setup, akun, database, dan backup](https://github.com/duhaalul/Dream-Space/blob/backend-dream-space/docs/OPERATIONS.md)
- [Kontrak API untuk integrasi frontend](https://github.com/duhaalul/Dream-Space/blob/backend-dream-space/docs/API.md)
- [Arsitektur dan pemetaan kebutuhan sistem](https://github.com/duhaalul/Dream-Space/blob/backend-dream-space/docs/ARCHITECTURE.md)
- [ERD Revisi 05](https://github.com/duhaalul/Dream-Space/blob/backend-dream-space/docs/ERD_Revisi_05.md)
- [Diagram ERD Mermaid](https://github.com/duhaalul/Dream-Space/blob/backend-dream-space/docs/erd.mmd)
- [Klarifikasi pembayaran sebelum mulai foto](https://github.com/duhaalul/Dream-Space/blob/backend-dream-space/docs/PAYMENT_RULE_CHANGE.md)

Untuk mengambil kode backend:

```bash
git clone --branch backend-dream-space https://github.com/duhaalul/Dream-Space.git
cd Dream-Space/backend
npm ci
```

Lanjutkan konfigurasi database, file `.env`, migrasi, dan seed akun mengikuti panduan setup. Kredensial lokal dan data database tidak disimpan dalam repositori.

## Batas Lingkup

Proyek ini tidak mencakup pemesanan mandiri oleh pelanggan, integrasi otomatis WhatsApp atau payment gateway, pengendalian kamera, penyimpanan hasil foto, promo/voucher, dan sistem akuntansi.

Acuan pengembangan adalah SRS Dream Space tanggal **10 November 2026**, ERD Revisi 05, serta klarifikasi pembayaran tanggal **11 November 2026**.
