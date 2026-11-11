# Kontrak API Dream Space

Base URL lokal: `http://localhost:3000/api`. Semua body JSON. Kirim `Authorization: Bearer <token>` selain login. Tanggal bisnis dalam WIB: `YYYY-MM-DD`, timestamp `YYYY-MM-DD HH:mm:ss`; nilai hasil MySQL dapat memiliki pecahan detik `.000`. Uang adalah integer Rupiah, maksimum Rp1.000.000.000.000 per transaksi. ID/nominal dikirim sebagai JSON number dalam rentang integer aman.

## Autentikasi

| Method | Endpoint | Akses / body |
|---|---|---|
| POST | `/auth/login` | `{ "username":"admin", "password":"..." }` → `{ token, user }` |
| GET | `/auth/me` | Akun aktif; termasuk `must_change_password` |
| POST | `/auth/change-password` | `{ current_password, new_password }`; minimal 12 karakter, maksimal 72 byte UTF-8; semua sesi dicabut |
| POST | `/auth/logout` | Cabut sesi saat ini, 204 |
| PATCH | `/auth/profile` | `{ name }`; username dan role tetap |
| POST | `/auth/reset-admin-password` | Owner: `{ temporary_password }`; seluruh sesi Admin dicabut |

JWT maksimal 12 jam dan sesi idle maksimal 30 menit. Token saja tidak cukup: backend memeriksa sesi setiap request. Jika `must_change_password=true`, hanya endpoint akun yang diperlukan untuk mengganti sandi/logout dapat digunakan. Frontend sebaiknya menyimpan token di memori, mengirim ulang login saat reload/expired; jangan menulis token ke log atau URL.

## Katalog

| Method | Endpoint | Hak |
|---|---|---|
| GET | `/packages` | Admin/Owner; hasil `{ packages, backgrounds, allowed_addons }` |
| GET | `/addons` | Admin/Owner |
| POST | `/packages` | Owner |
| PUT | `/packages/:id` | Owner; body lengkap |
| PATCH | `/packages/:id/availability` | Admin: `{ is_open, reason? }`; alasan wajib saat menutup |
| POST | `/addons` | Owner |
| PUT | `/addons/:id` | Owner; body lengkap |
| POST | `/packages/:id/backgrounds` | Owner |
| PUT | `/backgrounds/:id` | Owner; body lengkap |
| PUT | `/packages/:id/addons` | Owner: `{ "addon_ids":[1,2] }`; mengganti daftar yang diizinkan |

Body paket:

```json
{
  "name": "Reguler", "queue_code": "RG", "price_type": "PER_KELOMPOK",
  "price": 80000, "included_persons": 4, "extra_person_price": 15000,
  "min_persons": 1, "max_persons": 10,
  "description": "Durasi dan fasilitas ditulis Owner", "is_active": true
}
```

`price_type`: `PER_SESI`, `PER_ORANG`, `PER_KELOMPOK`. Field opsional nullable di atas default `null`. Paket kelompok wajib `included_persons`. Tarif per orang tidak memakai `included_persons`/`extra_person_price`. Kode paket huruf kapital/angka, dimulai huruf, maksimal 10 karakter.

Body latar: `{ "name":"Putih", "max_persons":4, "is_active":true }`.
Body tambahan: `{ "name":"Cetak 4R", "price":10000, "unit":"lembar", "is_active":true }`.
Tidak ada endpoint hapus master. Nonaktifkan untuk menjaga transaksi historis. Saat mengganti paket kunjungan, kosongkan tambahan paket lama terlebih dahulu.

## Kunjungan, antrean, dan riwayat

| Method | Endpoint | Body / hasil |
|---|---|---|
| GET | `/visits?date=2026-11-11&history=false&page=1&search=nama` | Admin/Owner, maksimal 100 per halaman. `history=true` hanya selesai/batal. Alternatif rentang `from` dan `to` maksimal 367 hari. |
| GET | `/visits/:id` | Detail lengkap |
| GET | `/queue/rooms` | Kondisi ruang dan pelanggan dipanggil/berjalan, termasuk yang berasal dari hari sebelumnya |
| POST | `/visits` | Admin; pendaftaran atomik dengan transaksi dan pembayaran opsional |
| PUT | `/visits/:id/selection` | Admin: `{ version, package_id, background_id, persons, reason }` |
| POST | `/visits/:id/actions` | Admin: `{ version, action, reason?, priority? }` |
| POST | `/visits/:id/finish` | Admin; konfirmasi akhir + pembayaran/refund opsional, atomik |

Pendaftaran walk-in:

```json
{
  "client_request_id": "7ce58f2b-8b96-4b4a-9487-6d9803f616cd",
  "customer_name": "Alul", "customer_type": "WALK_IN",
  "package_id": 1, "background_id": null, "persons": 2, "note": null
}
```

Pendaftaran reservasi tanpa paket dengan DP yang telah diverifikasi Admin:

```json
{
  "client_request_id": "e10535cf-9c2b-4944-bc15-e315e108de64",
  "customer_name": "Tamu Reservasi", "customer_type": "RESERVASI",
  "appointment_at": "2026-11-12 14:00:00",
  "payment": {
    "client_request_id": "5bba6117-bd57-47a1-8ba9-38cf0401bb97",
    "payment_type": "DP", "method": "TRANSFER", "amount": 50000,
    "paid_at": "2026-11-11 10:00:00", "reference": "BANK-REFERENSI-UNIK"
  }
}
```

Ganti tanggal contoh sesuai tanggal operasional. Reservasi baru tidak boleh untuk tanggal lewat. Jika memilih paket saat reservasi, isi jumlah orang dan latar yang valid; jika belum memilih paket, ketiganya kosong. Reservasi belum mendapat nomor antrean sampai `CONFIRM`.

Detail dan hasil mutasi mengembalikan:

```text
{ visit, transaction, balance: { paid, refunded, net, due, surplus },
  items, payments, refunds, events }
```

`items` memuat rincian aktif dan nonaktif untuk riwayat. Gunakan `is_active=1` untuk tagihan sekarang. Simpan `visit.version` dan `transaction.version` paling baru untuk request berikutnya.

| action | Dari → ke | Ketentuan |
|---|---|---|
| CONFIRM | RESERVASI → MENUNGGU | Hari janji, jam sudah tiba, paket lengkap. `priority` default true; false wajib alasan. |
| CALL | MENUNGGU → DIPANGGIL | Ruangan terbuka/kosong. Keluar urutan wajib alasan. |
| START | DIPANGGIL → SEDANG_DILAYANI | Seluruh tagihan yang sudah tercatat wajib lunas. Tambahan selama sesi dibayar di akhir. |
| SKIP | DIPANGGIL → DILEWATI | Wajib alasan. |
| RETURN | DILEWATI → MENUNGGU | Hari yang sama, wajib alasan; kehilangan prioritas, masuk belakang antrean biasa. |
| CANCEL | Sebelum mulai → DIBATALKAN | Wajib alasan; uang bersih ditahan. Tidak boleh membatalkan sesi berjalan. |

Prioritas: reservasi terkonfirmasi dulu, lalu jam janji, waktu masuk, ID. Kelompok biasa menurut waktu masuk dan ID. Nomor antrean tetap bukan jaminan urutan jika ada prioritas. Sisa antrean akhir hari dibatalkan Admin satu per satu dengan alasan; tidak ada pembatalan otomatis.

## Kasir

| Method | Endpoint | Body |
|---|---|---|
| PUT | `/transactions/:id/addons` | Admin: `{ version, addons:[{addon_id,qty}], reason }`; mengganti seluruh pilihan tambahan |
| POST | `/transactions/:id/payments` | Admin; body pembayaran di bawah |
| POST | `/transactions/:id/refunds` | Admin: `{ client_request_id, amount, method, reason }` |
| POST | `/transactions/:id/corrections` | Admin; koreksi dengan audit, lihat bawah |
| GET | `/transactions/:id/audit` | Admin/Owner; perubahan transaksi dan kunjungannya |
| GET | `/transactions/:id/receipt.pdf` | Admin/Owner; hanya setelah selesai |

Pembayaran:

```json
{
  "client_request_id": "1e3336c7-42aa-40b2-8f72-38e588527167",
  "payment_type": "PEMBAYARAN", "method": "TUNAI", "amount": 150000,
  "reference": null
}
```

**Untuk tunai, `amount` adalah uang yang diserahkan.** Backend menerapkan maksimal sisa tagihan dan menyimpan kembalian. Untuk transfer/QRIS, `amount` adalah penerimaan yang diverifikasi dan tidak boleh lebih dari sisa. DP hanya untuk reservasi; DP nontunai wajib referensi unik. `paid_at` opsional (default sekarang), tidak boleh masa depan. Tanpa paket, DP menjadi uang muka belum dialokasikan; `surplus=0` sampai tarif ditentukan. `due=0` pada tahap ini bukan berarti lunas.

Finish:

```json
{
  "version": 5, "transaction_version": 3, "persons": 2,
  "addons": [{ "addon_id": 1, "qty": 2 }],
  "reason": "Konfirmasi tambahan cetak",
  "payment": {
    "client_request_id": "ea9125cb-398b-4531-8530-76162ecaecc4",
    "payment_type": "PEMBAYARAN", "method": "TUNAI", "amount": 200000
  }
}
```

Kirim **seluruh** tambahan akhir, termasuk array kosong bila tidak ada. `reason` wajib jika transaksi yang sudah lunas diubah. `refund` dapat disertakan menggunakan body refund bila penyesuaian membuat kelebihan bayar. Jika saldo akhir tidak sama dengan tagihan, seluruh finish (termasuk pembayaran/perubahan rincian dalam request ini) dibatalkan. Nota baru tersedia setelah sukses.

Koreksi:

```json
{
  "version": 8,
  "reason": "Salah mencatat metode pembayaran",
  "customer_name": "Nama yang benar",
  "payments": [{ "id": 10, "method": "TRANSFER", "amount": 100000,
    "cash_received": null, "paid_at": "2026-11-11 10:00:00", "reference": "BANK-123" }],
  "items": []
}
```

Koreksi `payments` mengubah catatan salah dan menyimpan nilai sebelumnya dalam audit, tidak menghapus pembayaran. `items:[{id,unit_price}]` mengganti harga rincian aktif dengan rincian baru; rincian lama dinonaktifkan. Jumlah orang/tambahan sebelum selesai diubah lewat endpoint khusus. Koreksi selesai harus tetap seimbang; dapat menyertakan `payment`/`refund` **hanya bila uang benar-benar diterima/dikembalikan**. Status selesai tidak dibuka kembali. Transaksi batal hanya boleh mengoreksi nama/penerimaan, bukan menambah layanan atau refund.

## Dashboard dan laporan Owner

`GET /dashboard?period=today`

`GET /reports/{sales|packages|cash|visits}?period=custom&from=2026-11-01&to=2026-11-30&format=json`

- Periode: `today`, `week` (Senin–Minggu), `month`, `custom`.
- Format laporan: `json`, `pdf`, `xlsx`. Maksimum 10.000 baris; persempit periode bila lebih.
- `sales` / L-01: transaksi selesai berdasarkan `completed_at`.
- `packages` / L-02: jumlah sesi/nilai per paket, termasuk nol sesi; urut terbanyak.
- `cash` / L-03: pembayaran berdasarkan `paid_at` dikurangi refund berdasarkan `refunded_at`; pembayaran transaksi batal ditandai `BATAL_DITAHAN`.
- `visits` / L-04: kunjungan berdasarkan `service_date`, status, waktu, dan status pembayaran. Riwayat perpindahan/kejadian lengkap di detail kunjungan.
- Dashboard `cancelled_net_cash` adalah penerimaan dikurangi refund dalam periode untuk transaksi yang saat ini batal, bukan nilai penjualan.

## Retry, konflik, dan error

Frontend membuat UUID baru **sekali per tindakan** menggunakan `crypto.randomUUID()`. Simpan UUID dan payload yang sama saat retry pendaftaran/pembayaran/refund. Jangan membuat UUID baru karena timeout. `request_hash` adalah detail teknis backend; tidak perlu dikirim.

Retry mengembalikan ID yang sama dan detail terkini tanpa mutasi kedua. UUID yang sama dengan payload berbeda → 409. Perubahan berbasis `version` yang dikirim ulang dapat menghasilkan `STALE_VERSION`; GET detail terbaru untuk memastikan hasil sebelumnya, jangan mengulang dengan versi baru secara otomatis.

```json
{ "error": { "code":"STALE_VERSION", "message":"Data berubah di komputer lain; muat ulang sebelum melanjutkan", "request_id":"..." } }
```

Status: 401 login/sesi invalid, 403 hak akses/ganti sandi wajib, 404 tidak ditemukan, 409 konflik bisnis/versi, 422 isian tidak valid, 429 batas login, 503 server sibuk. Error validasi dapat memiliki `details`. Tampilkan pesan tanpa membuang input pengguna. Untuk 500 catat `request_id`, jangan menampilkan SQL/internal error.
