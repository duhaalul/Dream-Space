# Integrasi frontend - 15 November 2026

> **Catatan sejarah.** Dokumen ini merekam pemeriksaan integrasi 15 Nov 2026 (14 tes integrasi, frontend antrean/kasir saat itu masih `TodoCard`). Sejak itu banyak yang berubah: semua halaman sudah jadi, ada reservasi, laporan buku kas, dan 28 tes integrasi. Kondisi terkini ada di [API.md](API.md), README backend, dan README tiap modul frontend.

Penambahan ke `main` hanya mencakup folder `backend/`. File frontend dan README root tidak diubah. Branch frontend anggota tim tidak digabungkan dalam pekerjaan backend ini.

## Sumber yang diperiksa

- `main` pada commit `967ba44`: login, layout, proteksi route, komponen ganti/reset sandi, komponen buka/tutup ruangan, serta modul pembungkus API.
- `frontend-dream-space-larisa` pada commit `6a9e14f`: pengelolaan paket/latar/tambahan, profil, dashboard, dan laporan.
- Kelima file `modules/*/api.js` dan `shared/api/client.js` yang dipakai Larisa sama dengan yang ada di main pada saat pemeriksaan.

## Penyesuaian backend

| Temuan | Perubahan |
| --- | --- |
| Frontend menghapus sesi pada setiap respons 401 saat token aktif; sandi lama yang salah pada form ganti sandi sebelumnya juga mengirim 401 | `INVALID_PASSWORD` kini memakai 422. Pengguna dapat memperbaiki isian tanpa logout. Sesi invalid/dicabut tetap 401. |
| Login mengirim boolean `must_change_password`, tetapi refresh profil mengirim angka MySQL 0/1 | `/auth/me` kini mengirim boolean dengan bentuk field yang sama seperti `login.user`. |
| Form paket memetakan error berdasarkan `details[].path[0]`, tetapi validasi antarfield sebelumnya tanpa path | Error min/max orang, orang tercakup, dan tipe harga kini menunjuk field yang sesuai. |
| Client frontend membaca header request ID sebagai fallback | CORS mengekspos `X-Request-Id` dan `Content-Disposition` agar browser dapat membacanya. |

Endpoint dan payload utama dipertahankan karena sudah sesuai dengan modul API frontend. Tidak ada migrasi atau perubahan struktur database tambahan untuk penyesuaian ini.

## Verifikasi

- TypeScript strict, build, dan 2 unit test lulus.
- 14 integration test dengan MySQL lokal lulus (16 test keseluruhan).
- `test/frontend-contract.ts` membangun file API frontend asli menggunakan alias `@` dan `VITE_API_URL` test, tanpa mengubah frontend. Semua pemanggilan menggunakan fetch ke server HTTP sungguhan.
- Jalur kontrak frontend yang diuji: login, refresh/ubah profil, sandi lama salah tanpa logout, CRUD dasar katalog dan relasi, buka/tutup ruangan, pendaftaran/retry, penolakan START sebelum lunas, pembayaran awal, tambahan selama sesi, pembayaran akhir, riwayat, PDF nota, dashboard/laporan, PDF/XLSX, CORS, dan logout yang mencabut sesi.
- Snapshot harga, refund, koreksi, nomor antrean concurrent, prioritas reservasi, dan idle session tetap diuji oleh suite bisnis yang sudah ada.

Ini pengujian kontrak API, bukan bukti bahwa seluruh UI sudah selesai atau lulus UAT browser.

## Pekerjaan frontend yang masih terpisah

Pada main yang diperiksa, `QueueOverview`, `QueueBoard`, `VisitForm`, `VisitDetailModal`, `CashierPage`, dan `HistoryPage` masih berupa `TodoCard`. Karena belum ada formulir dan tombol operasional, alur antrean/kasir end-to-end melalui tampilan belum dapat diuji. Modul Larisa yang lengkap masih berada di branch Larisa, belum main.

Temuan untuk tim frontend: catatan `VisitDetailModal` menyebut perubahan nama melalui `updateVisitSelection`, padahal endpoint selection hanya mengubah paket/latar/jumlah orang. Untuk koreksi nama gunakan `addCorrection(transactionId,{version,reason,customer_name})` sesuai kontrak API. Backend tidak memperlonggar body selection secara diam-diam.

Setelah frontend siap, lakukan UAT browser untuk kedua role, printer fisik, ukuran layar kecil, dan keadaan jaringan terputus. Sebelum deployment, ukur waktu respons dan tetapkan backup terjadwal. Tidak ada workflow baru di root `.github/` karena perubahan dibatasi hanya pada folder backend; pemeriksaan dijalankan lewat perintah README backend.
