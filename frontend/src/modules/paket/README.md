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
| `components/PackageForm.jsx` | Kelola Paket › Pengaturan Skema Harga & Kapasitas Paket | Owner | Selesai |
| `components/AddonManager.jsx` | Kelola Paket › Tambahan layanan (dulu di Pengaturan) | Owner | Selesai |
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
| `createAddon(data)` / `updateAddon(id, data)` | `POST /addons` / `PUT /addons/:id` | Tambahan: `{ name, price, unit, is_active }` |
| `setPackageAvailability(id, isOpen, reason)` | `PATCH /packages/:id/availability` | Tutup/buka ruangan (Admin) |

Contoh body paket:
```json
{
  "name": "Reguler", "queue_code": "RG", "price_type": "PER_KELOMPOK",
  "price": 80000, "included_persons": 4, "extra_person_price": 15000,
  "min_persons": 1, "max_persons": 10,
  "description": "Durasi dan fasilitas ditulis Owner", "is_active": true
}
```

## Aturan wajib
- **Tidak ada hapus.** Paket, latar, dan tambahan dinonaktifkan (`is_active: false`). Paket nonaktif tidak muncul di pendaftaran baru.
- Cara hitung harga (`price_type`):
  - `PER_SESI`: harga tetap per sesi;
  - `PER_ORANG`: harga × jumlah orang, tanpa `included_persons`/`extra_person_price`;
  - `PER_KELOMPOK`: harga untuk `included_persons` orang (wajib) + `extra_person_price` per orang tambahan.
- Kode antrean: huruf kapital/angka, diawali huruf, maksimal 10 karakter (mis. `RG` → nomor `RG-001`).
- Kapasitas minimal/maksimal orang boleh kosong. Latar punya batas orangnya sendiri.
- Tampilkan **pratinjau harga** sebelum disimpan.
- Perubahan harga tidak mengubah transaksi yang sudah tercatat (backend menyimpan harga saat pendaftaran).
- Tambahan layanan berisi nama, harga, dan satuan, mis. "Tambah waktu Rp20.000 per 5 menit".
- Menutup ruangan wajib alasan, dan tidak bisa saat ada pelanggan dipanggil atau sedang foto.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `DUPLICATE_VALUE` (409) | Kode/nama sudah dipakai; tandai kolom kode/nama |
| `VALIDATION_ERROR` (422) | `error.details` berisi daftar kolom yang salah; tampilkan di kolomnya |
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
