# Keputusan backend dan cakupan SRS

Acuan dibaca dari folder MPSI: **SRS_Dream_Space..docx, SRS-DS-001, 10 November 2026**, beserta ERD Revisi 04 dan klarifikasi pengguna pada **11 November 2026**. Klarifikasi terbaru mengganti aturan pembayaran awal: foto hanya boleh dimulai setelah tagihan yang tercatat lunas; tambahan saat sesi dapat dilunasi di akhir. Instruksi terbaru ini diprioritaskan atas kalimat SRS sebelumnya. Harga tidak di-hardcode karena SRS menyerahkan pengisian kepada Owner. Dokumen pribadi sumber tidak diunggah ke repositori.

## Struktur dan batas

Express 5 + TypeScript strict, MySQL 8 melalui mysql2 tanpa ORM, Zod pada batas request, bcrypt cost 12, JWT dengan sesi server, pdfmake dan ExcelJS. SQL diparameterisasi; interpolasi SQL hanya konstanta/internal identifier atau pagination tervalidasi. Tidak ada registrasi akun, gateway pembayaran, booking pelanggan, WhatsApp, promo, penyimpanan foto, atau estimasi durasi otomatis.

`auth.ts` mengelola identitas/sesi; `catalog.ts` master; `operations.ts` transaksi bisnis atomik; `reports.ts` tampilan/ekspor; `db.ts` transaksi/penguncian/audit. Fungsi harga murni ada di `core.ts`. Pemisahan ini cukup untuk ukuran proyek sekarang, tanpa menambah ORM atau service jaringan lain.

## Data dan konkurensi

- 14 tabel ERD + `schema_migrations` sebagai penanda migrasi. Tambahan implementasi pada ERD: `request_hash CHAR(64)` di `visits`, `payments`, `refunds` untuk membandingkan payload retry asli, termasuk setelah data dikoreksi. Tidak mengubah proses bisnis.
- Snapshot tarif/rumus, nama rincian, satuan, latar, dan kode antrean mempertahankan sejarah. Menonaktifkan master tidak memblokir penyelesaian pilihan lama yang tidak berubah.
- `UNIQUE(package_id,service_date,queue_number)`, counter terkunci, `UNIQUE(transactions.visit_id)`, dan request UUID unik melindungi integritas.
- Mutasi bisnis menggunakan transaksi InnoDB, row lock, dan **satu named advisory lock per database** dengan timeout 2 detik. Ini sengaja menserialkan mutasi singkat di studio dua akun, termasuk beberapa proses API yang memakai database yang sama. Bcrypt serta rendering PDF/Excel dilakukan di luar transaksi mutasi. Kelemahannya: throughput tulis lebih rendah daripada kunci per ruangan murni; lakukan pengukuran sebelum memperluas ke banyak cabang. Jangan menghapus lock tanpa merancang urutan penguncian dan mengulang test konkurensi.
- Read model multiquery memakai transaksi read-only REPEATABLE READ agar detail/laporan konsisten. Audit disimpan dalam transaksi yang sama dengan perubahan. Tidak tersedia endpoint menghapus audit/pembayaran.
- `version` mencegah layar lama menimpa perubahan komputer lain. Pembayaran/refund menghitung saldo di server saat terkunci, bukan percaya total dari frontend.
- Nominal integer aman dan dibatasi; tidak memakai floating point pecahan Rupiah. Timestamp DB disimpan dalam konvensi WIB, koneksi disetel `+07:00`.
- Runtime database user produksi sebaiknya hanya SELECT/INSERT/UPDATE/DELETE; migrasi memakai user DDL terpisah. `package_addons` menggunakan penggantian relasi, sementara master/histori tidak dihapus.

## Aturan bisnis yang memerlukan interpretasi

1. SRS aturan 11 meminta sisa kunjungan akhir hari dibatalkan, aturan 18 melarang pembatalan setelah foto mulai. Implementasi menjaga aturan 18: sesi berjalan harus diselesaikan lewat kasir. Tidak ada auto-cancel.
2. Satu paket diasumsikan satu ruang/set. Jika studio memakai ruang bersama untuk beberapa paket, model resource bersama perlu ditambahkan; penguncian per paket tidak mewakili keadaan itu.
3. Reservasi tanpa paket boleh menerima DP. Saldo itu belum menjadi kelebihan bayar sebelum tagihan terbentuk. Pembayaran non-DP tanpa paket ditolak.
4. Paket hanya berpindah sebelum dipanggil. Nomor baru diterbitkan untuk paket tujuan; waktu masuk dan transaksi tetap, nomor lama tersimpan di event.
5. Pembatalan mempertahankan uang bersih sebagai total ditahan, sedangkan subtotal/rincian mencatat layanan semula. Pembatalan bukan penjualan selesai dan tidak membuat refund.
6. Koreksi pembayaran menyimpan before/after audit. Koreksi tidak otomatis membuat uang berpindah; pembayaran/refund nyata terpisah dapat disertakan secara atomik. Transaksi selesai wajib tetap seimbang setelah koreksi, tanpa membuka ulang sesi.
7. Dua akun bersama mengikuti SRS. Audit dapat menunjukkan akun/sesi, bukan membuktikan identitas karyawan individual.
8. Batas laporan 367 hari/10.000 baris dan 100 kunjungan per halaman mencegah ekspor tanpa batas menghabiskan memori. Performa SLA belum dijamin oleh unit/integration test.

## Pemetaan implementasi dan verifikasi

| Kebutuhan | Implementasi | Verifikasi otomatis |
|---|---|---|
| Akun tetap, role, sandi sementara, idle | auth + users/sessions | akses silang ditolak; perubahan/reset mencabut sesi; idle ditolak |
| Master dan pilihan latar | catalog + FK gabungan | latar paket lain ditolak; paket nonaktif menolak kunjungan baru |
| Tiga rumus harga, snapshot | priceLines + snapshot transaksi | rumus/batas nominal; perubahan master tidak mengubah kunjungan lama |
| Reservasi, DP, jam konfirmasi | visits + payments | tanpa paket, referensi nontunai wajib, tanggal uang berbeda layanan, janji belum tiba ditolak |
| Antrean dan satu ruang | counter/row lock/status | nomor unik bersamaan; hanya satu panggilan; prioritas/alasan/skip/return |
| Kasir, mulai, selesai, kembalian | payments + START + finish | mulai belum lunas ditolak; tambahan saat sesi dibayar di akhir; finish gagal rollback; tunai/kembalian; tagihan nol |
| Refund dan pembatalan | refunds + CANCEL | refund retry aman; batas saldo; uang batal ditahan; sesi berjalan tidak bisa batal |
| Koreksi dan audit | corrections + audit_logs | selesai tetap seimbang; perubahan metode tercatat dan status terminal bertahan |
| Nota, L01–L04, dashboard | reports | PDF dihasilkan; XLSX dibaca ulang; tanggal kas terpisah layanan |
| Idempotensi dan versi | UUID/hash/version | retry bersamaan tidak ganda; payload berbeda ditolak; stale version ditolak |

Suite saat implementasi: **2 unit test + 13 integration test** dengan sejumlah assertion/alur dalam setiap test, diuji pada MySQL 8.0.30 lokal. CI disediakan; status CI remote perlu dilihat setelah push. Backup/restore smoke test dan build dicatat dalam pekerjaan penyerahan, bukan pengganti UAT.

## Pekerjaan integrasi berikutnya

Frontend menghubungkan login → ganti password → master Owner → pendaftaran → antrean → kasir → nota. Gunakan kontrak API, jangan menghitung saldo final sendiri. QA melakukan UAT dengan daftar harga nyata dan printer studio. Deployment perlu HTTPS, pengaturan origin/proxy, user DB terbatas, backup terjadwal di lokasi terpisah, restore drill, serta pengukuran waktu respons pada beban nyata.

Override UUID ExcelJS ke versi 11 yang kompatibel CommonJS dipakai karena advisory versi transitif lama; ekspor/import XLSX diuji setelah override. Dependensi terkunci dalam package-lock.json.
