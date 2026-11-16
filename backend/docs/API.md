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

JWT maksimal 12 jam dan sesi idle maksimal 30 menit. Token saja tidak cukup: backend memeriksa sesi setiap request. Jika `must_change_password=true`, hanya endpoint akun yang diperlukan untuk mengganti sandi/logout dapat digunakan. Frontend sebaiknya menyimpan token di memori; jangan menulis token ke log atau URL. (Frontend Dream Space memakai `sessionStorage` per tab supaya reload tidak logout, lalu memeriksa token lewat `GET /auth/me` saat halaman dibuka; tutup tab = logout.)

`GET /auth/me` mengembalikan objek user dengan `must_change_password` boolean, sama seperti `login.user`. Sandi lama yang salah saat ganti sandi menghasilkan **422 INVALID_PASSWORD**, sehingga handler 401 frontend tidak mengeluarkan pengguna. Sesi invalid/dicabut tetap menghasilkan 401. Header `X-Request-Id` dan `Content-Disposition` dapat dibaca browser melalui CORS.

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
  "min_persons": 1, "max_persons": 10, "duration_minutes": 15,
  "description": "Fasilitas ditulis Owner", "is_active": true
}
```

`price_type`: `PER_SESI`, `PER_ORANG`, `PER_KELOMPOK`. Field opsional nullable di atas default `null`. `duration_minutes` (1–600, nullable) = durasi sesi untuk timer di Antrean; `null` berarti tanpa timer. Paket kelompok wajib `included_persons`. Tarif per orang tidak memakai `included_persons`/`extra_person_price`. Kode paket huruf kapital/angka, dimulai huruf, maksimal 10 karakter.

Body latar: `{ "name":"Putih", "max_persons":4, "is_active":true }`.
Body tambahan: `{ "name":"Tambah waktu", "price":20000, "unit":"5 menit", "extra_minutes":5, "is_active":true }`. `extra_minutes` (1–600, nullable) hanya untuk tambahan waktu: setiap qty menambah durasi sesi; `null` untuk tambahan lain (mis. cetak).
**Simpan paket sekaligus (pop-up Kelola Paket):** `POST /packages/setup` (buat) dan `PUT /packages/:id/setup` (ubah), Owner. Satu transaksi DB: paket, latar, dan tambahan tersimpan semua atau tidak sama sekali.

```json
{ "package": { "...": "body paket di atas" },
  "backgrounds": [{ "id": 5, "name": "Putih", "max_persons": 15, "is_active": true }, { "name": "Hitam", "max_persons": null, "is_active": true }],
  "addon_ids": [1, 2] }
```

Latar dengan `id` diubah (harus milik paket itu, `BACKGROUND_MISMATCH` bila tidak), tanpa `id` ditambah; latar yang tidak dikirim tidak berubah. Nama latar kembar dalam satu permintaan → 422 dengan path `backgrounds.N.name`; nama/kode yang sudah dipakai → 409 `DUPLICATE_VALUE`. `addon_ids` mengganti seluruh daftar tambahan paket. Hasil `{ id, ...package }`.

**Hapus tambahan:** `DELETE /addons/:id` (Owner) → `{ id, archived }`. Bila masih tercentang di paket mana pun → 409 `ADDON_IN_USE` (pesan memuat nama paketnya); lepas dulu lewat `PUT /packages/:id/addons` atau `/setup`. Bila belum pernah dipakai transaksi, baris dihapus permanen (`archived:false`); bila sudah pernah dipakai, diarsipkan (`is_active=false`, `archived:true`) karena riwayat/nota masih merujuk ke situ. Tambahan dengan `is_active=false` dianggap terhapus dan ditolak saat pendaftaran.

Paket dan latar tidak punya endpoint hapus; nonaktifkan untuk menjaga transaksi historis. Saat mengganti paket kunjungan, kosongkan tambahan paket lama terlebih dahulu.

## Kunjungan, antrean, dan riwayat

| Method | Endpoint | Body / hasil |
|---|---|---|
| GET | `/visits?date=2026-11-11&history=false&page=1&search=nama` | Admin/Owner, maksimal 100 per halaman. `history=true` hanya selesai/batal. Alternatif rentang `from` dan `to` maksimal 367 hari. |
| GET | `/visits/:id` | Detail lengkap |
| GET | `/queue/rooms` | Kondisi ruang dan pelanggan dipanggil/berjalan: `package_id,name,is_open,closed_reason,active_visit_id,customer_name,status,service_date,queue_code_snapshot,queue_number,started_at,session_minutes` |
| POST | `/visits/walk-in` | Admin; **alur utama datang langsung**: daftar + tambahan + bayar **lunas** dalam satu transaksi DB (lihat bawah) |
| POST | `/visits` | Admin; pendaftaran atomik dengan transaksi dan pembayaran opsional (dipakai reservasi) |
| PUT | `/visits/:id/selection` | Admin: `{ version, package_id, background_id, persons, reason }` |
| POST | `/visits/:id/actions` | Admin: `{ version, action, reason?, priority? }` |
| POST | `/visits/:id/finish` | Admin; konfirmasi akhir + pembayaran/refund opsional, atomik |

Pendaftaran datang langsung dengan pembayaran lunas (alur studio sejak 16 Nov 2026):

```json
{
  "client_request_id": "7ce58f2b-8b96-4b4a-9487-6d9803f616cd",
  "customer_name": "Bayu", "package_id": 1, "background_id": 1, "persons": 3,
  "addons": [{ "addon_id": 1, "qty": 2 }],
  "payment": { "client_request_id": "1e3336c7-42aa-40b2-8f72-38e588527167",
    "method": "TUNAI", "amount": 200000, "reference": null }
}
```

Tunai: `amount` = uang diserahkan (kembalian dihitung). Transfer/QRIS: `amount` = total. Kalau pembayaran tidak melunasi, seluruh pendaftaran dibatalkan (`PAYMENT_NOT_SETTLED`, 422). Tanpa `payment` hanya boleh untuk paket bertarif 0 (`PAYMENT_REQUIRED`). Request ID sama → hasil sama; isi berbeda → `IDEMPOTENCY_CONFLICT`. Setelah lunas, paket/latar/jumlah orang/tambahan **terkunci** (`PAID_LOCKED`, 409) sampai fitur koreksi tersedia.

Pendaftaran walk-in tanpa pembayaran (`POST /visits`, cara lama):

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
| START | DIPANGGIL → SEDANG_DILAYANI | Seluruh tagihan yang sudah tercatat wajib lunas. Mengisi `visit.session_minutes` = `duration_minutes` paket + Σ(qty × `extra_minutes`) tambahan aktif (`null` bila paket tanpa durasi). Timer = `started_at` + `session_minutes`. |
| SKIP | DIPANGGIL → DILEWATI | Wajib alasan. |
| RETURN | DILEWATI → MENUNGGU | Hari yang sama, wajib alasan; kehilangan prioritas, masuk belakang antrean biasa. |
| CANCEL | Sebelum mulai → DIBATALKAN | Wajib alasan; uang bersih ditahan. Tidak boleh membatalkan sesi berjalan. |
| FINISH | SEDANG_DILAYANI → SELESAI | Tagihan harus lunas (`UNSETTLED` bila tidak). Cukup `version`; dipakai tombol "Selesai" di Antrean. |

Prioritas: reservasi terkonfirmasi dulu, lalu jam janji, waktu masuk, ID. Kelompok biasa menurut waktu masuk dan ID. Nomor antrean tetap bukan jaminan urutan jika ada prioritas. **Tutup otomatis hari sebelumnya:** saat backend menyala lalu tiap 5 menit, kunjungan datang langsung dengan `service_date` sebelum hari ini ditutup: Menunggu/Dipanggil/Dilewati → DIBATALKAN (alasan "Otomatis: tidak ditutup di hari layanan", uang ditahan seperti CANCEL), Sedang foto yang lunas → SELESAI. Tercatat di `visit_events` (`AUTO_CANCEL`/`AUTO_FINISH`) dan audit atas nama akun Admin. Reservasi tidak disentuh.

## Kasir

| Method | Endpoint | Body |
|---|---|---|
| PUT | `/transactions/:id/addons` | Admin: `{ version, addons:[{addon_id,qty}], reason }`; mengganti seluruh pilihan tambahan |
| POST | `/transactions/:id/payments` | Admin; body pembayaran di bawah |
| POST | `/transactions/:id/refunds` | Admin: `{ client_request_id, amount, method, reason }` |
| POST | `/transactions/:id/corrections` | Admin; koreksi dengan audit, lihat bawah |
| GET | `/transactions/:id/audit` | Admin/Owner; perubahan transaksi dan kunjungannya |
| GET | `/transactions/:id/receipt.pdf` | Admin/Owner; tersedia sejak **lunas** (`paid_off_at`); nomor antrean dicetak besar di atas |

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

Kirim **seluruh** tambahan akhir, termasuk array kosong bila tidak ada. `reason` wajib jika transaksi yang sudah lunas diubah. `refund` dapat disertakan menggunakan body refund bila penyesuaian membuat kelebihan bayar. Jika saldo akhir tidak sama dengan tagihan, seluruh finish (termasuk pembayaran/perubahan rincian dalam request ini) dibatalkan. Endpoint ini dari alur lama; alur studio sekarang memakai aksi `FINISH`.

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

`GET /reports/{sales|packages|cash}?period=custom&from=2026-11-01&to=2026-11-30&format=json`

- Periode: `today`, `week` (Senin–Minggu), `month`, `custom`.
- Format laporan: `json`, `pdf`, `xlsx`. Maksimum 10.000 baris; persempit periode bila lebih.
- `sales` / L-01: transaksi **lunas** berdasarkan `paid_off_at` (penjualan diakui saat lunas, tanpa transaksi batal). Dashboard `sales`/`sessions` memakai dasar yang sama.
- `packages` / L-02: jumlah transaksi lunas/nilai per paket (dasar `paid_off_at`), termasuk nol; urut terbanyak.
- `cash` / L-03: pembayaran berdasarkan `paid_at` dikurangi refund berdasarkan `refunded_at`; pembayaran transaksi batal ditandai `BATAL_DITAHAN`.
- L-04 rekap kunjungan **dihapus** (16 Nov 2026); kebutuhannya dipenuhi menu Riwayat (`GET /visits?history=true`).
- Dashboard `cancelled_net_cash` adalah penerimaan dikurangi refund dalam periode untuk transaksi yang saat ini batal, bukan nilai penjualan.

## Retry, konflik, dan error

Frontend membuat UUID baru **sekali per tindakan** menggunakan `crypto.randomUUID()`. Simpan UUID dan payload yang sama saat retry pendaftaran/pembayaran/refund. Jangan membuat UUID baru karena timeout. `request_hash` adalah detail teknis backend; tidak perlu dikirim.

Retry mengembalikan ID yang sama dan detail terkini tanpa mutasi kedua. UUID yang sama dengan payload berbeda → 409. Perubahan berbasis `version` yang dikirim ulang dapat menghasilkan `STALE_VERSION`; GET detail terbaru untuk memastikan hasil sebelumnya, jangan mengulang dengan versi baru secara otomatis.

```json
{ "error": { "code":"STALE_VERSION", "message":"Data berubah di komputer lain; muat ulang sebelum melanjutkan", "request_id":"..." } }
```

Status: 401 login/sesi invalid, 403 hak akses/ganti sandi wajib, 404 tidak ditemukan, 409 konflik bisnis/versi, 422 isian tidak valid, 429 batas login, 503 server sibuk. Error validasi dapat memiliki `details`. Tampilkan pesan tanpa membuang input pengguna. Untuk 500 catat `request_id`, jangan menampilkan SQL/internal error.
