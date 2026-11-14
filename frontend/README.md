# Frontend Dream Space

Tampilan web Sistem Informasi Kasir dan Antrean Dream Space.
Teknologi sesuai SRS bab 3: **React + Vite, Tailwind CSS, Recharts**, terhubung ke backend lewat REST API.

## Menjalankan

```bash
cd frontend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm run dev               # http://localhost:5173
```

Backend harus berjalan di alamat yang ditulis di `VITE_API_URL` (bawaan `http://localhost:3000/api`).
Panduan backend: `docs/OPERATIONS.md` di branch `backend-dream-space`.

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi ke `dist/` |
| `npm run lint` | Pemeriksaan kode (oxlint) |
| `npm run preview` | Menjalankan hasil build |

## Struktur folder (per modul SRS 5.1)

```
src/
├── main.jsx          # titik awal aplikasi
├── index.css         # Tailwind
├── app/              # perakit: gabungan route, penjaga login/peran, layout + menu
├── modules/          # SATU FOLDER = SATU MODUL SRS
│   ├── akun/         # Akun dan Pengaturan
│   ├── paket/        # Paket dan Harga
│   ├── antrean/      # Antrean Layanan
│   ├── kasir/        # Kasir dan Pembayaran
│   └── laporan/      # Dashboard dan Laporan
└── shared/           # dipakai semua modul
    ├── api/client.js     # pemanggil API: token, error, sesi berakhir
    ├── components/ui/    # Button, Input, Select, Modal, Alert, Badge, Card, PageHeader
    └── utils/            # format Rupiah/tanggal, konstanta, newRequestId, unduh file
```

Isi setiap modul:

| File/folder | Isi |
|---|---|
| `api.js` | Fungsi pemanggil endpoint backend milik modul ini |
| `routes.js` | Daftar halaman modul, peran yang boleh membuka, dan menu |
| `pages/` | Halaman |
| `components/` | Komponen yang hanya dipakai modul ini |

## Pembagian modul

| Folder | Modul SRS | Halaman | Path |
|---|---|---|---|
| `modules/akun` | Akun dan Pengaturan | Login; Profil (ganti kata sandi sendiri, Owner juga reset kata sandi Admin) | `/login`, `/profil` |
| `modules/paket` | Paket dan Harga | Paket (Admin lihat) / Kelola Paket (Owner, termasuk tambahan layanan) | `/paket` |
| `modules/antrean` | Antrean Layanan | Antrean: tab Ringkasan, Per Paket, Pendaftaran (Admin); detail kunjungan dalam modal | `/antrean` |
| `modules/kasir` | Kasir dan Pembayaran | Kasir (Admin), Riwayat (Admin + koreksi, Owner lihat) | `/kasir`, `/kasir/:id`, `/riwayat` |
| `modules/laporan` | Dashboard dan Laporan | Dashboard, Laporan (Owner) | `/dashboard`, `/laporan` |

Menu per peran:

| Admin | Owner |
|---|---|
| Antrean (halaman awal), Kasir, Riwayat, Paket, Profil | Dashboard (halaman awal), Antrean, Riwayat, Kelola Paket, Laporan, Profil |

Pengaturan (T-10 di SRS) tidak dipakai: tambahan layanan pindah ke Kelola Paket, reset kata sandi Admin pindah ke Profil Owner.

## Pegangan kerja per modul

Setiap modul punya README sendiri. **Baca README modul Anda sebelum mulai.** Isinya: halaman dan komponen yang dikerjakan, API, aturan bisnis wajib, kode error backend yang perlu ditangani, hubungan dengan modul lain, checklist selesai, dan cara mengetes.

| Modul | Pegangan kerja |
|---|---|
| Akun | [src/modules/akun/README.md](src/modules/akun/README.md) |
| Paket | [src/modules/paket/README.md](src/modules/paket/README.md) |
| Antrean | [src/modules/antrean/README.md](src/modules/antrean/README.md) |
| Kasir | [src/modules/kasir/README.md](src/modules/kasir/README.md) |
| Laporan | [src/modules/laporan/README.md](src/modules/laporan/README.md) |

Saat bagian selesai, centang checklist di README modul dan ubah kolom Status.
Bila desain memuat bagian yang endpoint-nya tidak ada di `docs/API.md` (branch backend), tanyakan ke tim backend sebelum membuatnya.

## Aturan kerja

1. **Kerjakan di folder modul sendiri.** Halaman baru: buat di `pages/`, lalu daftarkan di `routes.js` modul itu. File di `app/` tidak perlu diubah.
2. **Impor pakai `@/`**, contoh `import { Button } from '@/shared/components/ui'`.
3. **Antarmodul:** bebas memakai `shared/`. Memakai modul lain hanya untuk bagian yang memang dibagi:
   - `@/modules/akun/useAuth` (data pengguna yang login),
   - `@/modules/paket/components/RoomAvailabilityToggle` (dipakai di Antrean),
   - fungsi baca `getPackages()` dan `getAddons()` dari `@/modules/paket/api` (dipakai Antrean dan Kasir).
4. **Semua panggilan backend lewat `api.js` modul**, jangan `fetch` langsung di halaman.
5. **Saat menyimpan** (NFR-02, NFR-04):
   - pakai `<Button loading={...}>` supaya tidak terkirim dua kali;
   - pendaftaran/pembayaran/refund: buat `client_request_id` dengan `newRequestId()` **sekali per tindakan**, pakai ulang saat mencoba lagi;
   - bila gagal, tampilkan `error.message` dengan `<Alert variant="error">` dan **jangan kosongkan isian**;
   - error `STALE_VERSION`: muat ulang data, jangan kirim ulang otomatis.
6. **Hak akses di frontend hanya untuk tampilan.** Backend tetap memeriksa setiap permintaan (NFR-01).
7. Halaman yang belum selesai memakai `<TodoCard>`. Hapus setelah halamannya dibuat.

## Login dan sesi

- Token disimpan di memori (saran `docs/API.md`), jadi **reload halaman = login ulang**.
- Sesi berakhir di backend setelah 30 menit tidak aktif. Permintaan berikutnya mendapat 401 dan pengguna otomatis kembali ke Login.
- Setiap akun mengganti kata sandinya sendiri di Profil. Owner bisa mereset kata sandi Admin (mis. Admin lupa kata sandi), lalu Admin wajib menggantinya saat login.
- Akun dengan kata sandi sementara (`must_change_password`) hanya bisa membuka Profil sampai kata sandinya diganti.
- Setelah ganti kata sandi, semua sesi dicabut backend dan pengguna diminta login ulang.

## Status

Sudah berfungsi: Login, logout, penjaga halaman per peran, menu Admin/Owner, layout komputer dan HP, tab di halaman Antrean, Profil (ganti kata sandi; reset kata sandi Admin untuk Owner), dan semua fungsi `api.js` sesuai `docs/API.md`.

Belum dikerjakan (bertanda TODO): isi tab Antrean (Ringkasan, Per Paket, Pendaftaran), detail kunjungan, Kasir, Riwayat, Kelola Paket, tambahan layanan, Dashboard, dan Laporan.

## Deploy (Vercel)

| Pengaturan | Nilai |
|---|---|
| Root Directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_URL=https://<alamat-backend>/api` |

`vercel.json` sudah mengarahkan semua path ke `index.html`, jadi membuka `/antrean` langsung tidak 404.
Di backend, isi `FRONTEND_ORIGIN` dengan alamat Vercel yang persis sama (tanpa `/` di akhir).
