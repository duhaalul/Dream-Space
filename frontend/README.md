# Frontend Dream Space

Tampilan web Sistem Informasi Kasir dan Antrean Dream Space.
Teknologi sesuai SRS bab 3: **React + Vite, Tailwind CSS, Recharts**, terhubung ke backend lewat REST API.
Tambahan: ikon **lucide-react**, font **Poppins** dan **Fraunces** (paket `@fontsource`, tanpa Google Fonts).

## Mulai cepat

Mulai dari branch **`main`**, lalu buat branch kerja Anda sendiri. Pastikan akun GitHub Anda sudah diundang sebagai collaborator repo.

```bash
git clone https://github.com/duhaalul/Dream-Space.git
cd Dream-Space
git switch -c frontend-dream-space-larisa          # branch kerja Anda sendiri, dibuat dari main
git push -u origin frontend-dream-space-larisa

cd frontend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm run dev               # buka http://localhost:5173
```

- Isi `VITE_API_URL` di `.env` dengan alamat backend (bawaan `http://localhost:3000/api`). Panduan backend: `docs/OPERATIONS.md` di branch `backend-dream-space`.
- Contoh semua komponen dasar: buka **http://localhost:5173/dev/komponen** (hanya saat `npm run dev`).
- Lalu baca **README modul Anda** (tabel "Pegangan kerja per modul" di bawah).

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi ke `dist/` |
| `npm run lint` | Pemeriksaan kode (oxlint) |
| `npm run preview` | Menjalankan hasil build |

## Pembagian kerja & kesepakatan tim

| Orang | Bagian | Folder | Dipakai oleh |
|---|---|---|---|
| **Ihsan** | Menu samping, komponen dasar, Login, sesi login | `app/`, `shared/`, `modules/akun/` (kecuali halaman Profil) | Admin & Owner |
| **Ihsan** | Antrean | `modules/antrean/` | Admin (mencatat), Owner (lihat) |
| **Ihsan** | Kasir & Riwayat | `modules/kasir/` | Kasir: Admin · Riwayat: Admin & Owner |
| **Larisa** | Paket / Kelola Paket | `modules/paket/` | Admin (lihat, tutup/buka ruangan), Owner (kelola) |
| **Larisa** | Dashboard & Laporan | `modules/laporan/` | Owner |
| **Larisa** | Halaman Profil | `modules/akun/pages/ProfilePage.jsx` | Admin & Owner |

### 1. Batas file
- Kerjakan hanya folder milik Anda.
- `app/`, `shared/`, `modules/akun/AuthContext.jsx`, dan `modules/akun/useAuth.js` hanya diubah oleh **Ihsan**. Butuh komponen atau fungsi bantu baru? Minta ke Ihsan, atau buat dulu di folder modul Anda sendiri.

### 2. Komponen dasar wajib dipakai
- Pakai komponen dari `@/shared/components/ui` (lihat "Komponen dasar"), jangan membuat tombol, kolom isian, atau kartu sendiri. Dengan begitu tampilan seragam, dan perubahan gaya cukup dilakukan di satu tempat.
- Nama dan props komponen tidak akan diubah tanpa kabar.

### 3. Kontrak antarmodul (jangan diubah tanpa kabar)
| Kontrak | Pemilik | Dipakai di |
|---|---|---|
| `RoomAvailabilityToggle` dengan props `{ packageId, isOpen, onChanged }` | Larisa (**dikerjakan paling awal**) | Antrean |
| `getPackages()` dan `getAddons()` di `modules/paket/api.js` | Larisa | Antrean, Kasir |
| Alamat `/kasir/:id` (`id` = id kunjungan) | Ihsan | Antrean |
| `useAuth()` → `{ user, logout, ... }`, `user.role` | Ihsan | Semua |

### 4. Backend & data uji
- Pakai **satu backend bersama**. Minta tim backend men-deploy-nya, lalu isi alamatnya di `VITE_API_URL`.
- Password awal akun `admin` dan `owner` diminta ke tim backend. Jangan ditulis di repo.
- Paket untuk uji coba dibuat lewat halaman Kelola Paket. Karena itu form paket dikerjakan lebih dulu.

### 5. Git
- `main` = tempat pekerjaan semua orang digabung.
- Branch kerja, keduanya dibuat dari `main`: Ihsan `frontend-dream-space-ihsan`, Larisa `frontend-dream-space-larisa`.
- Ambil pembaruan terbaru dari `main` secara rutin, terutama setelah Ihsan memberi kabar ada perubahan menu/komponen:
  ```bash
  git pull origin main
  ```
- Simpan pekerjaan: `git add …`, `git commit -m "…"`, `git push`.
- Bagian selesai → buat **pull request dari branch Anda ke `main`**. Ihsan memeriksa lalu melakukan merge.
- Jangan push langsung ke `main` atau ke branch orang lain.
- Jangan menambah paket npm tanpa kabar, karena `package-lock.json` mudah bentrok.

### 6. Jadwal
| Tanggal | Ihsan | Larisa |
|---|---|---|
| 15 Nov | Mulai Antrean | `RoomAvailabilityToggle` + Kelola Paket |
| 16–17 Nov | Antrean & Kasir | Dashboard, Laporan, Profil |
| 18 Nov | Uji bersama alur penuh: pelanggan datang → bayar → foto → nota → laporan | |
| 19 Nov | Serah terima | |

### 7. Kapan bagian dianggap selesai
- Checklist di README modul tercentang dan kolom Status diperbarui.
- `npm run build` dan `npm run lint` lulus.
- Semua langkah "Cara mengetes" di README modul lulus.

## Tema desain (dari Figma)

Desain memakai palet Tailwind. Warna dan font khusus didefinisikan di `src/index.css` (`@theme`):

| Pakai class | Nilai | Untuk |
|---|---|---|
| `font-sans` (bawaan) | Poppins | Semua teks |
| `font-display font-black font-soft` | Fraunces (mirip font judul desain) | Judul halaman, tulisan "Dream Space" |
| `brand-500` / `brand-600` | `#00A4E4` / `#0284C7` | Warna utama: tombol, tab aktif, teks biru |
| `brand-50` / `brand-100` / `brand-200` | biru sangat muda | Latar lembut, badge, garis |
| `emerald-500` → `cyan-500` | gradien hijau toska | Tombol "success", periode aktif |
| `amber-500` → `red-500` | gradien oranye | Tombol "warning" (Panggil) |
| `brand-yellow` | `#FEF300` | Kuning logo |

Logo: `<BrandLogo />`; gambarnya `src/assets/logo-ds.png`. File ini sementara (hasil potongan gambar desain); ganti dengan ekspor resmi Figma memakai nama file yang sama.

## Komponen dasar

Impor dari satu tempat: `import { Button, Card, StatCard } from '@/shared/components/ui'`.
Contoh tampilan semua komponen ada di `/dev/komponen`.

| Komponen | Props utama | Contoh |
|---|---|---|
| `PageHeader` | `title`, `description?`, `actions?` | `<PageHeader title="Laporan" actions={<SegmentedControl …/>} />` |
| `Button` | `variant`, `size` (`sm`/`md`/`lg`), `loading`, `type`, `onClick` | `<Button variant="success" loading={saving}>Simpan</Button>` |
| `Card` | `title?`, `description?`, `actions?`, `children` | `<Card title="Pembayaran">…</Card>` |
| `StatCard` | `label`, `value`, `hint?`, `icon?`, `tone` (`brand`/`green`) | `<StatCard label="Sesi Selesai" value="3 Sesi" tone="green" />` |
| `SegmentedControl` | `options: [{ value, label }]`, `value`, `onChange`, `tone` (`success`/`brand`), `label` | Periode laporan, metode bayar, tab |
| `Table` | `columns: [{ key, header, align?, render? }]`, `rows`, `rowKey?`, `empty?` | Tabel Riwayat dan Laporan |
| `Input` | `label`, `error?`, `hint?` + atribut `<input>` | `<Input label="Uang Diterima" value={…} onChange={…} />` |
| `Select` | `label`, `options: [{ value, label }]`, `placeholder?`, `error?` | `<Select label="Paket" options={…} />` |
| `Badge` | `tone` (`brand`/`green`/`amber`/`red`/`gray`) | `<Badge tone="amber">Belum Lunas</Badge>` |
| `Alert` | `variant` (`error`/`success`/`warning`/`info`), `requestId?` | `<Alert variant="error">{error.message}</Alert>` |
| `Modal` | `open`, `title`, `onClose`, `footer?` | Dialog alasan, detail kunjungan |
| `BrandLogo` | `size` (`sm`/`md`/`lg`) | Logo dalam kotak biru |
| `TodoCard` | `title`, `items` | Penanda sementara; hapus setelah halaman jadi |

Varian `Button` sesuai desain:

| Varian | Tampilan | Contoh di desain |
|---|---|---|
| `primary` | biru gradien | Terima Pembayaran |
| `success` | hijau toska gradien | Datang Langsung, Mulai Foto, Selesaikan |
| `warning` | oranye-merah gradien | Panggil |
| `secondary` | putih bergaris | Reservasi WhatsApp |
| `soft` | biru muda | Ke Kasir, Kembalikan ke Antrean |
| `soft-success` | hijau muda | Unduh Excel |
| `danger` | merah muda | Batalkan, Unduh PDF |
| `neutral` | abu-abu | Lewati |
| `ghost` | transparan | Tombol ikon |

Fungsi bantu di `@/shared/utils/`: `formatRupiah(150000)` → `Rp150.000`, `formatDate`, `formatTime`, `formatDateTime`, `todayWib()`, `newRequestId()`, `saveBlob()`, `openBlob()`, serta konstanta status/metode/peran di `constants.js`.

## Struktur folder (per modul SRS 5.1)

```
src/
├── main.jsx          # titik awal aplikasi (+ font)
├── index.css         # Tailwind + tema desain
├── assets/           # logo
├── app/              # perakit: gabungan route, penjaga login/peran, menu samping
├── modules/          # SATU FOLDER = SATU MODUL SRS
│   ├── akun/         # Akun dan Pengaturan
│   ├── paket/        # Paket dan Harga
│   ├── antrean/      # Antrean Layanan
│   ├── kasir/        # Kasir dan Pembayaran
│   └── laporan/      # Dashboard dan Laporan
└── shared/           # dipakai semua modul
    ├── api/client.js     # pemanggil API: token, error, sesi berakhir
    ├── components/ui/    # komponen dasar (lihat di atas)
    └── utils/            # format Rupiah/tanggal, konstanta, newRequestId, unduh file
```

Isi setiap modul:

| File/folder | Isi |
|---|---|
| `api.js` | Fungsi pemanggil endpoint backend milik modul ini |
| `routes.js` | Daftar halaman modul, peran yang boleh membuka, dan menu (label + ikon) |
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

| Modul | Penanggung jawab | Pegangan kerja |
|---|---|---|
| Akun | Ihsan (Login, sesi) · Larisa (halaman Profil) | [src/modules/akun/README.md](src/modules/akun/README.md) |
| Paket | Larisa | [src/modules/paket/README.md](src/modules/paket/README.md) |
| Antrean | Ihsan | [src/modules/antrean/README.md](src/modules/antrean/README.md) |
| Kasir | Ihsan | [src/modules/kasir/README.md](src/modules/kasir/README.md) |
| Laporan | Larisa | [src/modules/laporan/README.md](src/modules/laporan/README.md) |

Saat bagian selesai, centang checklist di README modul dan ubah kolom Status.
Bila desain memuat bagian yang endpoint-nya tidak ada di `docs/API.md` (branch backend), tanyakan ke tim backend sebelum membuatnya.

## Aturan kerja

1. **Kerjakan di folder modul sendiri.** Halaman baru: buat di `pages/`, lalu daftarkan di `routes.js` modul itu. File di `app/` tidak perlu diubah.
2. **Impor pakai `@/`**, contoh `import { Button } from '@/shared/components/ui'`.
3. **Antarmodul:** bebas memakai `shared/`. Memakai modul lain hanya untuk bagian yang memang dibagi (lihat "Kontrak antarmodul").
4. **Semua panggilan backend lewat `api.js` modul**, jangan `fetch` langsung di halaman.
5. **Saat menyimpan** (NFR-02, NFR-04):
   - pakai `<Button loading={...}>` supaya tidak terkirim dua kali;
   - pendaftaran/pembayaran/refund: buat `client_request_id` dengan `newRequestId()` **sekali per tindakan**, pakai ulang saat mencoba lagi;
   - bila gagal, tampilkan `error.message` dengan `<Alert variant="error">` dan **jangan kosongkan isian**;
   - error `STALE_VERSION`: muat ulang data, jangan kirim ulang otomatis.
6. **Hak akses di frontend hanya untuk tampilan.** Backend tetap memeriksa setiap permintaan (NFR-01).
7. **Halaman Owner harus nyaman di HP** (NFR-03): cek di DevTools dengan lebar 390px, tanpa scroll ke samping.
8. Halaman yang belum selesai memakai `<TodoCard>`. Hapus setelah halamannya dibuat.

## Login dan sesi

- Token disimpan di memori (saran `docs/API.md`), jadi **reload halaman = login ulang**.
- Sesi berakhir di backend setelah 30 menit tidak aktif. Permintaan berikutnya mendapat 401 dan pengguna otomatis kembali ke Login.
- Setiap akun mengganti kata sandinya sendiri di Profil. Owner bisa mereset kata sandi Admin (mis. Admin lupa kata sandi), lalu Admin wajib menggantinya saat login.
- Akun dengan kata sandi sementara (`must_change_password`) hanya bisa membuka Profil sampai kata sandinya diganti.
- Setelah ganti kata sandi, semua sesi dicabut backend dan pengguna diminta login ulang.

## Status

Sudah berfungsi:
- Login sesuai Figma, logout, penjaga halaman per peran.
- Menu samping sesuai Figma (komputer) dan bilah atas (HP).
- Semua komponen dasar sesuai Figma, termasuk `StatCard`, `SegmentedControl`, dan `Table`.
- Tab di halaman Antrean.
- Profil: ganti kata sandi; reset kata sandi Admin untuk Owner.
- Semua fungsi `api.js` sesuai `docs/API.md`.

Belum dikerjakan (bertanda TODO): isi tab Antrean, detail kunjungan, Kasir, Riwayat, Kelola Paket, tambahan layanan, Dashboard, Laporan, dan tampilan Profil sesuai Figma.

## Deploy (Vercel)

| Pengaturan | Nilai |
|---|---|
| Root Directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_URL=https://<alamat-backend>/api` |

`vercel.json` sudah mengarahkan semua path ke `index.html`, jadi membuka `/antrean` langsung tidak 404.
Di backend, isi `FRONTEND_ORIGIN` dengan alamat Vercel yang persis sama (tanpa `/` di akhir).
