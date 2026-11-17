# Keputusan backend dan cakupan SRS

Acuan dibaca dari folder MPSI: **SRS_Dream_Space..docx, SRS-DS-001, 10 November 2026**, beserta ERD Revisi 04 dan klarifikasi pengguna pada **11 November 2026**. Klarifikasi terbaru mengganti aturan pembayaran awal: foto hanya boleh dimulai setelah tagihan yang tercatat lunas; tambahan saat sesi dapat dilunasi di akhir. Instruksi terbaru ini diprioritaskan atas kalimat SRS sebelumnya. Harga tidak di-hardcode karena SRS menyerahkan pengisian kepada Owner. Dokumen pribadi sumber tidak diunggah ke repositori.

## Struktur dan batas

Express 5 + TypeScript strict, MySQL 8 melalui mysql2 tanpa ORM, Zod pada batas request, bcrypt cost 12, JWT dengan sesi server, pdfmake dan ExcelJS. SQL diparameterisasi; interpolasi SQL hanya konstanta/internal identifier atau pagination tervalidasi. Tidak ada registrasi akun, gateway pembayaran, booking mandiri oleh pelanggan, integrasi WhatsApp, promo, penyimpanan foto, atau estimasi waktu tunggu. Reservasi lewat WhatsApp **dicatat Admin** (nomor WhatsApp hanya disimpan dan dibuka sebagai tautan `wa.me`).

> Pembaruan 17 Nov 2026: SRS bukan lagi satu-satunya acuan karena klien meminta banyak perubahan; acuan terkini adalah kode, `API.md`, dan README modul. Bagian di bawah sudah disesuaikan.

`auth.ts` mengelola identitas/sesi; `catalog.ts` master; `operations.ts` transaksi bisnis atomik; `reports.ts` tampilan/ekspor; `db.ts` transaksi/penguncian/audit. Fungsi harga murni ada di `core.ts`. Pemisahan ini cukup untuk ukuran proyek sekarang, tanpa menambah ORM atau service jaringan lain.

## Data dan konkurensi

- 14 tabel ERD + `schema_migrations` sebagai penanda migrasi. Tambahan implementasi pada ERD: `request_hash CHAR(64)` di `visits`, `payments`, `refunds` untuk membandingkan payload retry asli, termasuk setelah data dikoreksi. Tidak mengubah proses bisnis. Kolom dari migrasi 002–004 dan kolom sisa yang tidak dipakai dicatat di `ERD_Revisi_05.md`.
- Snapshot tarif/rumus, nama rincian, satuan, latar, dan kode antrean mempertahankan sejarah. Paket yang **masih dipakai** (antrean/sesi/reservasi belum datang) tidak bisa dinonaktifkan (`PACKAGE_IN_USE`), karena paket nonaktif disembunyikan dari papan Antrean.
- `UNIQUE(package_id,service_date,customer_type,queue_number)` (nomor datang langsung `RG-001` dan reservasi `RG-R001` terpisah), counter terkunci per `kind`, `UNIQUE(transactions.visit_id)`, dan request UUID unik melindungi integritas.
- Mutasi bisnis menggunakan transaksi InnoDB, row lock, dan **satu named advisory lock per database** dengan timeout 2 detik. Ini sengaja menserialkan mutasi singkat di studio dua akun, termasuk beberapa proses API yang memakai database yang sama. Bcrypt serta rendering PDF/Excel dilakukan di luar transaksi mutasi. Kelemahannya: throughput tulis lebih rendah daripada kunci per ruangan murni; lakukan pengukuran sebelum memperluas ke banyak cabang. Jangan menghapus lock tanpa merancang urutan penguncian dan mengulang test konkurensi.
- Read model multiquery memakai transaksi read-only REPEATABLE READ agar detail/laporan konsisten. Audit disimpan dalam transaksi yang sama dengan perubahan. Tidak tersedia endpoint menghapus audit/pembayaran.
- `version` mencegah layar lama menimpa perubahan komputer lain. Pembayaran/refund menghitung saldo di server saat terkunci, bukan percaya total dari frontend.
- Nominal integer aman dan dibatasi; tidak memakai floating point pecahan Rupiah. Timestamp DB disimpan dalam konvensi WIB, koneksi disetel `+07:00`.
- Runtime database user produksi sebaiknya hanya SELECT/INSERT/UPDATE/DELETE; migrasi memakai user DDL terpisah. `package_addons` menggunakan penggantian relasi, sementara master/histori tidak dihapus.

## Aturan bisnis yang memerlukan interpretasi

1. **Tutup otomatis hari sebelumnya** (sejak 16 Nov 2026): saat backend menyala lalu tiap 5 menit, kunjungan yang sudah masuk antrean dari hari sebelumnya ditutup. Menunggu/Dipanggil/Dilewati → Dibatalkan (uang ditahan), Sedang foto yang lunas → Selesai (sesi yang sudah mulai tidak boleh dibatalkan, aturan SRS 18). Reservasi yang belum datang tidak disentuh.
2. Satu paket diasumsikan satu ruang/set. Jika studio memakai ruang bersama untuk beberapa paket, model resource bersama perlu ditambahkan; penguncian per paket tidak mewakili keadaan itu.
3. **Reservasi wajib paket** (sejak 17 Nov 2026) supaya lama pemakaian ruangan diketahui: jam reservasi di paket yang sama tidak boleh bentrok (durasi paket + tambah waktu). Data lama tanpa paket tetap didukung: DP-nya belum menjadi kelebihan bayar sampai paket dipilih saat Sudah Datang.
4. Reservasi belum datang bisa diubah (paket, tambahan, jadwal) lewat `PUT /visits/:id/reservation`: kurang bayar dilunasi saat datang, kelebihan bayar **wajib di-refund** pada simpan yang sama. Setelah masuk Menunggu semuanya terkunci (koreksi menyusul).
5. Pembatalan mempertahankan uang bersih sebagai total ditahan, sedangkan rincian mencatat layanan semula. Pembatalan bukan penjualan selesai dan tidak membuat refund (DP maupun lunas).
6. Koreksi pembayaran menyimpan before/after audit. Koreksi tidak otomatis membuat uang berpindah; pembayaran/refund nyata terpisah dapat disertakan secara atomik. Transaksi selesai wajib tetap seimbang setelah koreksi, tanpa membuka ulang sesi.
7. Dua akun bersama mengikuti SRS. Audit dapat menunjukkan akun/sesi, bukan membuktikan identitas karyawan individual.
8. Batas laporan 367 hari/10.000 baris dan 100 kunjungan per halaman mencegah ekspor tanpa batas menghabiskan memori. Performa SLA belum dijamin oleh unit/integration test.

## Pemetaan implementasi dan verifikasi

| Kebutuhan | Implementasi | Verifikasi otomatis |
|---|---|---|
| Akun tetap, role, sandi sementara, idle | auth + users/sessions | akses silang ditolak; perubahan/reset mencabut sesi; idle ditolak |
| Master dan pilihan latar | catalog + FK gabungan | latar paket lain ditolak; paket nonaktif menolak kunjungan baru |
| Tiga rumus harga, snapshot | priceLines + snapshot transaksi | rumus/batas nominal; perubahan master tidak mengubah kunjungan lama |
| Reservasi: DP/Lunas, jadwal tanpa bentrok | `/visits/reservation`, availability, check-in | paket wajib; bentrok jam per paket; DP < total; Sudah Datang melunasi sisa + tambahan (tidak berkurang); nomor `RG-R001` |
| Ubah Reservasi + refund | `PUT /visits/:id/reservation` + refunds | turun paket wajib refund (Tunai/Transfer); naik paket dibayar saat datang; retry refund aman |
| Antrean dan satu ruang | counter/row lock/status | nomor unik bersamaan; hanya satu panggilan; panggil di luar urutan tanpa alasan; **Kembali ke Antrean** (UNCALL) ke urutan semula |
| Datang langsung, mulai, selesai, kembalian | walk-in lunas + START + FINISH | mulai belum lunas ditolak; tunai/kembalian; tagihan nol; tutup otomatis hari sebelumnya |
| Refund dan pembatalan | refunds + CANCEL | uang batal ditahan (tanpa refund); sesi berjalan tidak bisa batal; Riwayat mencatat reservasi batal pada tanggal batal |
| Koreksi dan audit | corrections + audit_logs | selesai tetap seimbang; perubahan metode tercatat dan status terminal bertahan (tampilan koreksi menyusul) |
| Nota, L-01/L-02 buku kas, dashboard | reports | nota hanya bila lunas penuh/selesai; L-01 per pembayaran + refund minus; dashboard = uang bersih; PDF/XLSX |
| Katalog | catalog | simpan paket + latar + tambahan sekaligus; tambahan dipakai paket tak bisa dihapus; paket dipakai tak bisa dinonaktifkan |
| Idempotensi dan versi | UUID/hash/version | retry bersamaan tidak ganda; payload berbeda ditolak; stale version ditolak |

Suite per 17 November 2026: **2 unit test + 28 integration test**, termasuk modul API frontend asli melalui HTTP (`test/frontend-contract.ts`), diuji pada MySQL 8.0.30 lokal. CI pernah disediakan pada branch backend lama; penambahan ke main hanya mencakup folder backend sehingga tidak menambah workflow root. Jalankan pemeriksaan melalui README backend. Backup/restore smoke test dan build bukan pengganti UAT.

## Pekerjaan integrasi berikutnya

Frontend menghubungkan login → ganti password → master Owner → pendaftaran → antrean → kasir → nota. Gunakan kontrak API, jangan menghitung saldo final sendiri. QA melakukan UAT dengan daftar harga nyata dan printer studio. Deployment perlu HTTPS, pengaturan origin/proxy, user DB terbatas, backup terjadwal di lokasi terpisah, restore drill, serta pengukuran waktu respons pada beban nyata.

Override UUID ExcelJS ke versi 11 yang kompatibel CommonJS dipakai karena advisory versi transitif lama; ekspor/import XLSX diuji setelah override. Dependensi terkunci dalam package-lock.json.
