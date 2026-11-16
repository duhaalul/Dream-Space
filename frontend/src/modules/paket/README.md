# Modul Paket

Pegangan kerja modul **Paket dan Harga** (SRS 5.1, 5.4). Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
Owner mengelola paket, harga, kapasitas, latar, dan tambahan layanan. Admin melihat paket dan menutup/membuka ruangan paket sementara.
FR-02, FR-03 · UC-03, UC-04, UC-05, UC-06.

## Penanggung jawab
**Larisa**, kecuali `components/RoomAvailabilityToggle.jsx` (dibuat dan dipegang Ihsan, sudah selesai).

> **Prioritas (15 Nov):** kerjakan form paket lebih dulu, karena data paket dibutuhkan untuk menguji Antrean dan Kasir.

## Halaman & komponen
| File | Layar di Figma | Peran | Status |
|---|---|---|---|
| `pages/PackagesPage.jsx` | Paket (Admin) / Kelola Paket (Owner) | Admin lihat, Owner kelola | Selesai |
| `components/PackageForm.jsx` | Pop-up tambah/ubah paket: Info Paket, Pilihan Latar, Tambahan Tersedia, **satu tombol Simpan** | Owner | Selesai |
| `components/AddonManager.jsx` | Tambahan Layanan (tetap di halaman, bukan pop-up): tambah, Ubah, Hapus | Owner | Selesai |
| `components/RoomAvailabilityToggle.jsx` | Antrean › tombol tutup/buka ruangan | Admin | Selesai (Ihsan) |

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Melihat daftar paket | ✓ | ✓ |
| Tambah/ubah/nonaktifkan paket, latar, tambahan layanan | — | ✓ |
| Tutup/buka ruangan paket sementara | ✓ | — (lihat status) |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `getPackages()` | `GET /packages` | Daftar paket → `{ packages, backgrounds, allowed_addons }` |
| `getAddons()` | `GET /addons` | Daftar tambahan layanan |
| `createPackage(data)` / `updatePackage(id, data)` | `POST /packages` / `PUT /packages/:id` | Simpan paket (PUT = body lengkap) |
| `createBackground(packageId, data)` / `updateBackground(id, data)` | `POST /packages/:id/backgrounds` / `PUT /backgrounds/:id` | Latar: `{ name, max_persons, is_active }` |
| `setPackageAddons(packageId, addonIds)` | `PUT /packages/:id/addons` | Centang tambahan yang tersedia (mengganti seluruh daftar) |
| `createAddon(data)` / `updateAddon(id, data)` | `POST /addons` / `PUT /addons/:id` | Tambahan: `{ name, price, unit, extra_minutes, is_active }` |
| `deleteAddon(id)` | `DELETE /addons/:id` | Hapus tambahan → `{ id, archived }`; 409 `ADDON_IN_USE` bila masih dipakai paket |
| `setPackageAvailability(id, isOpen, reason)` | `PATCH /packages/:id/availability` | Tutup/buka ruangan (Admin) |
| `createPackageSetup(data)` / `updatePackageSetup(id, data)` | `POST /packages/setup` / `PUT /packages/:id/setup` | Pop-up: `{ package, backgrounds: [{ id?, name, max_persons, is_active }], addon_ids }` disimpan sekaligus (satu transaksi) |

Contoh body paket:
```json
{
  "name": "Reguler", "queue_code": "RG", "price_type": "PER_KELOMPOK",
  "price": 80000, "included_persons": 4, "extra_person_price": 15000,
  "min_persons": 1, "max_persons": 10, "duration_minutes": 15,
  "description": "Fasilitas ditulis Owner", "is_active": true
}
```

## Aturan wajib
- **Durasi Sesi** (`duration_minutes`, wajib di form, 1–600 menit) dipakai timer di Antrean saat Mulai Foto. Tambahan berisi **Nama** (huruf pertama otomatis kapital), **Harga**, dan **Per [jumlah] [satuan]** (satuan diketik bebas). Disimpan sebagai `unit` = "5 menit" (atau cukup "lembar" bila jumlah 1). Bila satuannya `menit`/`mnt` (atau `jam` ×60), `extra_minutes` otomatis terisi sehingga menambah timer sesi; satuan lain → `null`.
- Tambah/ubah paket lewat **pop-up** dengan **satu tombol Simpan**. Semua bagian dikirim sekaligus (`createPackageSetup`/`updatePackageSetup`), jadi tidak ada paket yang tersimpan setengah. Hanya latar baru dan latar lama yang berubah yang dikirim.
- Paket dan latar **tidak dihapus**, cukup dinonaktifkan (`is_active: false`); paket nonaktif tidak muncul di pendaftaran baru.
- Tambahan layanan **tanpa** aktif/nonaktif: cukup **Ubah** dan **Hapus** (dengan konfirmasi). Tambahan yang **masih tercentang di paket** tidak bisa dihapus: muncul peringatan "… belum bisa dihapus" berisi nama paketnya (backend: `ADDON_IN_USE`). Tambahan yang sudah pernah dipakai transaksi diarsipkan oleh backend (disembunyikan, riwayat tetap utuh).
- Cara hitung harga (`price_type`):
  - `PER_SESI`: harga tetap per sesi;
  - `PER_ORANG`: harga × jumlah orang, tanpa `included_persons`/`extra_person_price`;
  - `PER_KELOMPOK`: harga untuk `included_persons` orang (wajib) + `extra_person_price` per orang tambahan.
- Kode antrean: huruf kapital/angka, diawali huruf, maksimal 10 karakter (mis. `RG` → nomor `RG-001`).
- Kapasitas minimal/maksimal orang boleh kosong. Latar punya batas orangnya sendiri.
- Tampilkan **pratinjau harga** sebelum disimpan (satu baris "Contoh N orang = RpX").
- Perubahan harga tidak mengubah transaksi yang sudah tercatat (backend menyimpan harga saat pendaftaran).
- Contoh tambahan: "Tambah waktu Rp20.000 / 5 menit" (menambah timer 5 menit per jumlah), "Tambah cetak 4R Rp15.000 / lembar".
- Menutup ruangan wajib alasan, dan tidak bisa saat ada pelanggan dipanggil atau sedang foto.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `DUPLICATE_VALUE` (409) | Nama/kode paket atau nama latar sudah dipakai; pesan di pop-up, isian tidak hilang |
| `VALIDATION_ERROR` (422) | `error.details[].path` (`package.price`, `backgrounds.1.name`); tampilkan di kolom/baris latarnya |
| `REASON_REQUIRED` | Alasan menutup ruangan masih kosong |
| `ROOM_BUSY` | Ruangan masih dipakai; belum bisa ditutup |

## Hubungan dengan modul lain
- **Dipakai `antrean`:**
  - `RoomAvailabilityToggle` dengan props `{ packageId, isOpen, onChanged }`;
  - `getPackages()` untuk pilihan paket, latar, dan kapasitas di form pendaftaran.
- **Dipakai `kasir`:** `getAddons()` dan `getPackages()` untuk pilihan tambahan dan ganti paket.
- Jangan mengubah nama atau props komponen dan fungsi di atas tanpa koordinasi.

## Checklist selesai
- [x] Daftar paket (nama, kode, harga, kapasitas, latar, aktif/nonaktif, status ruangan)
- [x] Form paket dengan 3 cara hitung harga + pratinjau harga
- [x] Kelola latar per paket
- [x] Centang tambahan yang tersedia per paket
- [x] Kelola tambahan layanan (`AddonManager`)
- [x] Tombol tutup/buka ruangan (`RoomAvailabilityToggle`) dengan alasan (dibuat Ihsan)
- [x] Admin hanya melihat (tanpa tombol ubah)
- [x] Kelola Paket nyaman dibuka di HP (Owner)
- [x] `npm run build` dan `npm run lint` lulus
- [ ] Semua langkah uji di bawah lulus

## Cara mengetes
1. Owner menambah paket `PER_KELOMPOK` Rp110.000 untuk 2 orang + Rp30.000/orang → pratinjau 4 orang = Rp170.000.
2. Simpan dua paket dengan kode yang sama → pesan kode sudah dipakai.
3. Nonaktifkan paket → paket tidak muncul di tab Pendaftaran Antrean.
4. Login Admin → halaman Paket tanpa tombol ubah.
5. Admin menutup ruangan tanpa alasan → ditolak. Saat ada pelanggan dipanggil → pesan ruangan masih dipakai.
