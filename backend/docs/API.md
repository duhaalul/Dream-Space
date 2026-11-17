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
| PUT | `/packages/:id` | Owner; body lengkap. Menonaktifkan (`is_active: false`) paket yang masih dipakai → 409 `PACKAGE_IN_USE` (lihat bawah) |
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

**Paket yang masih dipakai tidak bisa dinonaktifkan** (sejak 17 Nov 2026), baik lewat `PUT /packages/:id` maupun `PUT /packages/:id/setup`.
- "Dipakai" = ada kunjungan paket itu berstatus MENUNGGU, DIPANGGIL, SEDANG_DILAYANI, DILEWATI, atau RESERVASI (tanggal berapa pun, termasuk reservasi terlewat).
- Ditolak dengan 409 `PACKAGE_IN_USE`, contoh pesan: "Premium Studio masih dipakai: 1 sedang foto, 2 reservasi belum datang. Selesaikan sesi/antreannya dan batalkan atau pindahkan reservasinya dulu."
- Alasannya: paket nonaktif disembunyikan dari papan Antrean dan Pendaftaran, sehingga sesinya tidak bisa dijangkau lagi (termasuk tombol Selesai).
- Kunjungan Selesai/Dibatalkan tidak dihitung. Mengaktifkan dan mengubah isian lain tidak terpengaruh.

## Kunjungan, antrean, dan riwayat

| Method | Endpoint | Body / hasil |
|---|---|---|
| GET | `/visits?date=2026-11-11&history=false&page=1&search=nama` | Admin/Owner, maksimal 100 per halaman. Tiap baris: kolom `visits` + `transaction_id, transaction_no, total, payment_status, transaction_version` + **`paid`** (uang bersih = pembayaran − refund; kartu Reservasi menampilkan "Sisa" = `total − paid`). `history=true` hanya selesai/batal (Riwayat, tanggal mana pun untuk kedua peran); **reservasi yang dibatalkan sebelum datang** (belum punya nomor antrean) dicatat pada **tanggal pembatalannya** (`transactions.cancelled_at`), yang lain pada `service_date`. Alternatif rentang `from` dan `to` maksimal 367 hari. |
| GET | `/visits/:id` | Detail lengkap |
| GET | `/queue/rooms` | Kondisi ruang dan pelanggan dipanggil/berjalan: `package_id,name,is_open,closed_reason,active_visit_id,customer_name,customer_type,status,service_date,queue_code_snapshot,queue_number,started_at,session_minutes` |
| POST | `/visits/walk-in` | Admin; **tab Di Tempat**: daftar + tambahan + bayar **lunas** dalam satu transaksi DB (lihat bawah) |
| POST | `/visits/reservation` | Admin; **tab Reservasi**: jadwal + paket (wajib) + tambahan + bayar DP/LUNAS (Transfer/QRIS), satu transaksi DB; jam tidak boleh bentrok |
| GET | `/reservations/availability?date=&package_id=&minutes=[&visit_id=]` | Admin; jam reservasi yang masih bisa dipilih → `{ slots: ['13:15', …] }` |
| POST | `/visits/:id/check-in` | Admin; **"Sudah Datang"**: (tambah tambahan) + lunasi sisa + masuk Menunggu (nomor `RG-R001`), satu transaksi DB |
| PUT | `/visits/:id/reservation` | Admin; **Ubah Reservasi** yang belum datang: nama, WA, jadwal, paket, latar, orang, tambahan + refund kelebihan bayar, satu transaksi DB |
| PATCH | `/visits/:id/appointment` | Admin; ubah jadwal saja (cara lama, dipakai tes; tampilan memakai `PUT /visits/:id/reservation`) |
| POST | `/visits` | Admin; pendaftaran atomik dengan pembayaran opsional (cara lama, dipakai tes; tampilan memakai endpoint di atas) |
| PUT | `/visits/:id/selection` | Admin: `{ version, package_id, background_id, persons, reason }` |
| POST | `/visits/:id/actions` | Admin: `{ version, action, reason? }` |
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

### Reservasi WhatsApp (sejak 17 Nov 2026)

`POST /visits/reservation`:

```json
{
  "client_request_id": "e10535cf-9c2b-4944-bc15-e315e108de64",
  "customer_name": "Citra", "phone": "0812 3456 7890",
  "appointment_at": "2026-11-20 14:00:00",
  "package_id": 1, "background_id": 1, "persons": 3,
  "addons": [{ "addon_id": 1, "qty": 1 }],
  "payment": { "client_request_id": "5bba6117-bd57-47a1-8ba9-38cf0401bb97",
    "type": "DP", "method": "TRANSFER", "amount": 50000, "reference": null }
}
```

- **Jadwal:** toko buka 13.00–21.00 WIB. `appointment_at` wajib menit kelipatan 15, dari 13.15 sampai 20.45 (`APPOINTMENT_INVALID`); tanggal tidak boleh lewat (`PAST_APPOINTMENT`). Jam yang sudah lewat hari ini disaring di frontend.
- **Paket wajib** (sejak 17 Nov 2026): `package_id` + `persons` (+ `background_id` bila paket punya latar aktif), kosong → `PACKAGE_REQUIRED` (422). Lama pemakaian ruangan harus diketahui supaya jam tidak bentrok.
- **Tidak boleh bentrok:** lama pemakaian = `duration_minutes` paket (kosong → 15) + Σ(qty × `extra_minutes`) tambahan yang dipesan. Rentang [jam, jam + lama) tidak boleh tumpang-tindih dengan reservasi lain **di paket yang sama, tanggal yang sama**, yang belum selesai/batal (termasuk yang sudah datang) → 409 `RESERVATION_CLASH` ("Jam 14.15 bentrok dengan reservasi 14.00–14.20 di paket ini"). Paket lain boleh di jam yang sama. Datang langsung tidak dihitung (diatur lewat urutan antrean).
- **Pembayaran wajib** dan hanya `TRANSFER`/`QRIS`; `reference` opsional (bila diisi harus unik).
  - `DP`: nominal diketik Admin, harus < total (`DP_TOO_LARGE`).
  - `LUNAS`: `amount` = total; kurang → `PAYMENT_NOT_SETTLED`, seluruh reservasi batal.
- `phone` opsional: spasi/tanda hubung dibuang, sisanya 8–15 angka (boleh diawali `+`). Disimpan di `visits.phone`.
- Status `RESERVASI`, belum ada nomor antrean. Nota tersedia bila langsung lunas (memuat baris "Reservasi: tgl jam").
- Request ID sama → hasil sama; isi berbeda → `IDEMPOTENCY_CONFLICT`.

`POST /visits/:id/check-in` ("Sudah Datang"):

```json
{ "version": 3, "package_id": 1, "background_id": 1, "persons": 2, "addons": [],
  "payment": { "client_request_id": "ea9125cb-398b-4531-8530-76162ecaecc4", "method": "TUNAI", "amount": 100000, "reference": null } }
```

- Hanya status `RESERVASI` (`INVALID_TRANSITION`) dan pada tanggal reservasi (`WRONG_SERVICE_DATE`, 409), jam berapa pun. Datang di hari lain → Ubah Reservasi dulu.
- Paket/latar/orang dari reservasi **terkunci**; jangan kirim field itu (`PACKAGE_LOCKED`). Ganti paket lewat `PUT /visits/:id/reservation` sebelum datang.
- **Tambahan boleh ditambah** (sejak 17 Nov 2026): kirim **seluruh** tambahan akhir di `addons`; jumlah tiap tambahan yang sudah dipesan tidak boleh berkurang (`ADDON_DECREASE_NOT_ALLOWED`, 422). `addons: []` = tidak ada perubahan. Total naik → sisanya ikut dibayar di `payment` yang sama.
- Data lama tanpa paket (dibuat sebelum paket wajib) → `package_id` + `persons` wajib (`PACKAGE_REQUIRED`); tambahan boleh. DP lebih besar dari total → `DP_EXCEEDS_TOTAL` (pilih paket/tambahan lain).
- Masih ada sisa → `payment` wajib (`PAYMENT_REQUIRED`), Tunai/Transfer/QRIS, harus melunasi (`PAYMENT_NOT_SETTLED`). Sudah lunas → tanpa `payment`.
- Hasil: status `MENUNGGU`, nomor reservasi sendiri per paket per hari (`queue_number` dari penghitung `RESERVASI`; label `RG-R001`), `queue_entered_at = appointment_at`, event `CHECK_IN`.
- Kirim ulang dengan `payment.client_request_id` yang sama setelah berhasil → hasil sama tanpa pembayaran kedua.

`PUT /visits/:id/reservation` ("Ubah Reservasi", sejak 17 Nov 2026):

```json
{ "version": 4, "customer_name": "Citra", "phone": "0812 3456 7890",
  "appointment_at": "2026-11-20 15:00:00",
  "package_id": 2, "background_id": 1, "persons": 2,
  "addons": [{ "addon_id": 1, "qty": 1 }],
  "refund": { "client_request_id": "0f6d6c8e-6a3b-4a8e-9a43-3c1f1f9b2d11", "method": "TRANSFER" } }
```

- Hanya status `RESERVASI` (`INVALID_TRANSITION`); setelah datang semuanya terkunci.
- Kirim **seluruh** isian akhir (nama, WA, jadwal, paket, latar, orang, tambahan). Aturan jadwal, paket wajib, dan bentrok sama dengan `POST /visits/reservation`; dirinya sendiri tidak dihitung bentrok, lama pemakaian memakai paket + tambahan baru.
- Harga: ganti paket → harga paket **sekarang**; paket sama → harga saat reservasi tetap.
- Uang bersih yang sudah dibayar (`balance.net`) dibandingkan dengan total baru:
  - kurang → status `BELUM_LUNAS`, sisanya dibayar saat Sudah Datang (tidak ada uang berpindah sekarang);
  - sama → `LUNAS`;
  - lebih → **wajib refund** kelebihannya di simpan yang sama: tanpa `refund` → 422 `REFUND_REQUIRED`. `refund.method` hanya `TUNAI`/`TRANSFER` (QRIS hanya menerima). Nominal dihitung backend; tanpa referensi.
- Kirim ulang dengan `refund.client_request_id` yang sama setelah berhasil → hasil sama tanpa refund kedua. Tanpa refund, `version` lama → `STALE_VERSION`.
- Event `EDIT_RESERVATION` + audit (nilai sebelum/sesudah).
- `paid_off_at` tidak dikosongkan saat total naik; pakai `transaction.payment_status === 'LUNAS'` untuk menentukan lunas.

`PATCH /visits/:id/appointment` `{ version, appointment_at }` (cara lama): hanya status `RESERVASI`; aturan jadwal dan bentrok sama (dirinya sendiri tidak dihitung); `service_date` ikut berubah, DP/paket tetap. Event `RESCHEDULE`.

`GET /reservations/availability` (Admin): jam yang masih bisa dipilih pada `date` (belum lewat bila hari ini, tidak bentrok). Reservasi baru: `package_id` + `minutes` (durasi paket + tambah waktu yang sedang dipilih; kosong → durasi paket). Ubah Reservasi: tambah `visit_id` (reservasi itu tidak dihitung bentrok); tanpa `package_id` → paket dan lama pemakaian reservasi itu. Tanggal lewat → `slots: []`.

Label nomor antrean: `queue_code_snapshot` + `-` + (`R` bila `customer_type = RESERVASI`) + `queue_number` 3 digit. Datang langsung `RG-001`, reservasi `RG-R001`.

Pendaftaran walk-in tanpa pembayaran (`POST /visits`, cara lama):

```json
{
  "client_request_id": "7ce58f2b-8b96-4b4a-9487-6d9803f616cd",
  "customer_name": "Alul", "customer_type": "WALK_IN",
  "package_id": 1, "background_id": null, "persons": 2, "note": null
}
```

Pendaftaran reservasi lewat `POST /visits` (cara lama, tanpa tambahan; tampilan memakai `POST /visits/reservation`):

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

Ganti tanggal contoh sesuai tanggal operasional. Aturan jadwal sama dengan `POST /visits/reservation`. Jika memilih paket saat reservasi, isi jumlah orang dan latar yang valid; jika belum memilih paket, ketiganya kosong. Reservasi belum mendapat nomor antrean sampai check-in.

Detail dan hasil mutasi mengembalikan:

```text
{ visit, transaction, balance: { paid, refunded, net, due, surplus },
  items, payments, refunds, events }
```

`items` memuat rincian aktif dan nonaktif untuk riwayat. Gunakan `is_active=1` untuk tagihan sekarang. Simpan `visit.version` dan `transaction.version` paling baru untuk request berikutnya.

| action | Dari → ke | Ketentuan |
|---|---|---|
| CALL | MENUNGGU → DIPANGGIL | Ruangan terbuka/kosong. Boleh di luar urutan tanpa alasan (keputusan Admin). |
| UNCALL | DIPANGGIL → MENUNGGU | Tombol **"Kembali ke Antrean"** (salah panggil / belum di tempat), sejak 17 Nov 2026. Tanpa alasan. `called_at` dikosongkan, `queue_entered_at` tetap → kembali ke **urutan semula**; ruangan langsung kosong. |
| START | DIPANGGIL → SEDANG_DILAYANI | Seluruh tagihan yang sudah tercatat wajib lunas. Mengisi `visit.session_minutes` = `duration_minutes` paket + Σ(qty × `extra_minutes`) tambahan aktif (`null` bila paket tanpa durasi). Timer = `started_at` + `session_minutes`. |
| SKIP | DIPANGGIL → DILEWATI | Wajib alasan. **Tidak dipakai tampilan lagi** (diganti UNCALL); tetap diterima backend. |
| RETURN | DILEWATI → MENUNGGU | Hari yang sama, wajib alasan; jam masuk = sekarang, jadi masuk paling belakang. Tampilan hanya untuk data lama berstatus Dilewati. |
| CANCEL | Sebelum mulai → DIBATALKAN | Wajib alasan; uang bersih ditahan, **tidak dikembalikan** (DP maupun reservasi yang sudah lunas). Berlaku juga untuk status RESERVASI. Tidak boleh membatalkan sesi berjalan. |
| FINISH | SEDANG_DILAYANI → SELESAI | Tagihan harus lunas (`UNSETTLED` bila tidak). Cukup `version`; dipakai tombol "Selesai" di Antrean. |

Aksi `CONFIRM` dan field `priority` sudah dihapus (17 Nov 2026); reservasi masuk antrean lewat `POST /visits/:id/check-in` yang mewajibkan lunas.

**Urutan antrean** (`GET /visits`): `COALESCE(queue_entered_at, appointment_at)`, lalu ID. Jam masuk datang langsung = saat mendaftar; reservasi = **jam reservasinya** (diisi saat check-in), walau datang terlambat atau lebih awal. Nomor antrean bukan jaminan urutan. **Tutup otomatis hari sebelumnya:** saat backend menyala lalu tiap 5 menit, kunjungan yang sudah masuk antrean (datang langsung maupun reservasi yang sudah check-in) dengan `service_date` sebelum hari ini ditutup: Menunggu/Dipanggil/Dilewati → DIBATALKAN (alasan "Otomatis: tidak ditutup di hari layanan", uang ditahan seperti CANCEL), Sedang foto yang lunas → SELESAI. Tercatat di `visit_events` (`AUTO_CANCEL`/`AUTO_FINISH`) dan audit atas nama akun Admin. Reservasi yang belum datang (status RESERVASI) **tidak** disentuh: tetap ada sampai Admin membatalkan atau mengubah jadwalnya.

## Kasir

| Method | Endpoint | Body |
|---|---|---|
| PUT | `/transactions/:id/addons` | Admin: `{ version, addons:[{addon_id,qty}], reason }`; mengganti seluruh pilihan tambahan |
| POST | `/transactions/:id/payments` | Admin; body pembayaran di bawah |
| POST | `/transactions/:id/refunds` | Admin: `{ client_request_id, amount, method, reason }` |
| POST | `/transactions/:id/corrections` | Admin; koreksi dengan audit, lihat bawah |
| GET | `/transactions/:id/audit` | Admin/Owner; perubahan transaksi dan kunjungannya |
| GET | `/transactions/:id/receipt.pdf` | Admin/Owner; tersedia bila sesi **SELESAI** atau **lunas penuh**: `paid_off_at` terisi **dan** uang bersih ≥ jumlah rincian aktif. Selain itu 409 `RECEIPT_NOT_READY` (mis. reservasi lunas yang naik paket sebelum sisanya dibayar, atau batal setelah naik paket). Nomor antrean (`RG-001`/`RG-R001`) dicetak besar di atas; reservasi ikut mencetak jadwalnya |

Pembayaran:

```json
{
  "client_request_id": "1e3336c7-42aa-40b2-8f72-38e588527167",
  "payment_type": "PEMBAYARAN", "method": "TUNAI", "amount": 150000,
  "reference": null
}
```

**Untuk tunai, `amount` adalah uang yang diserahkan.** Backend menerapkan maksimal sisa tagihan dan menyimpan kembalian. Untuk transfer/QRIS, `amount` adalah penerimaan yang diverifikasi dan tidak boleh lebih dari sisa. DP hanya untuk reservasi. `reference` opsional untuk semua metode; bila diisi harus unik (`DUPLICATE_VALUE`). `paid_at` opsional (default sekarang), tidak boleh masa depan. Tanpa paket, DP menjadi uang muka belum dialokasikan; `surplus=0` sampai tarif ditentukan. `due=0` pada tahap ini bukan berarti lunas.

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

## Dashboard dan laporan

`GET /dashboard?period=today` (Owner)

`GET /reports/{sales|packages}?period=custom&from=2026-11-01&to=2026-11-30&format=json` (Owner; **Admin hanya hari ini**: `period=today` atau `custom` dengan from = to = hari ini, selain itu 403 `REPORT_TODAY_ONLY`)

- Periode: `today`, `week` (Senin–Minggu), `month`, `custom`.
- Format laporan: `json`, `pdf`, `xlsx`. Maksimum 10.000 baris; persempit periode bila lebih.
- **Penjualan = buku kas**: uang masuk per pembayaran pada hari bayar (`payments.paid_at`) dan uang keluar per refund pada hari refund (`refunds.refunded_at`), sejak 17 Nov 2026:
  - DP reservasi → baris `DP`;
  - pelunasan saat datang → baris `Lunas` sebesar sisanya;
  - bayar penuh sekaligus (Di Tempat / reservasi lunas) → satu baris `Lunas`;
  - kelebihan bayar yang dikembalikan saat Ubah Reservasi → baris `Refund` dengan `amount` **negatif**;
  - kunjungan yang kemudian dibatalkan tetap tercatat (uangnya ditahan, tidak ada refund).
- `sales` / L-01 Penjualan: satu baris per pembayaran/refund, urut waktu: `paid_at` (waktu bayar atau waktu refund), `transaction_no, customer_name, customer_type ("Di Tempat"|"Reservasi"), package_name, persons, method ("Tunai"|"Transfer"|"QRIS"), status ("DP"|"Lunas"|"Refund"), amount`. Jumlah `amount` = uang bersih.
- `packages` / L-02 Penjualan per Paket: L-01 dikelompokkan per paket kunjungan: `package_id, name, payments` (jumlah pembayaran masuk, refund tidak dihitung), `sales` (bersih, sudah dikurangi refund); paket tanpa pembayaran ikut tampil; urut penjualan terbesar.
- L-03 penerimaan uang **dihapus** (17 Nov 2026) dan L-04 rekap kunjungan **dihapus** (16 Nov 2026); `GET /reports/cash` dan `/reports/visits` → 422.
- Dashboard: `{ from, to, sales, dp: { count, amount }, lunas: { count, amount }, refund: { count, amount }, methods: [{ method, amount }], packages, visits_by_status }`. `refund.amount` positif; `sales` = jumlah `amount` L-01 = `dp.amount + lunas.amount − refund.amount` = jumlah `methods` (bersih per metode).

## Retry, konflik, dan error

Frontend membuat UUID baru **sekali per tindakan** menggunakan `crypto.randomUUID()`. Simpan UUID dan payload yang sama saat retry pendaftaran/pembayaran/refund. Jangan membuat UUID baru karena timeout. `request_hash` adalah detail teknis backend; tidak perlu dikirim.

Retry mengembalikan ID yang sama dan detail terkini tanpa mutasi kedua. UUID yang sama dengan payload berbeda → 409. Perubahan berbasis `version` yang dikirim ulang dapat menghasilkan `STALE_VERSION`; GET detail terbaru untuk memastikan hasil sebelumnya, jangan mengulang dengan versi baru secara otomatis.

```json
{ "error": { "code":"STALE_VERSION", "message":"Data berubah di komputer lain; muat ulang sebelum melanjutkan", "request_id":"..." } }
```

Status: 401 login/sesi invalid, 403 hak akses/ganti sandi wajib, 404 tidak ditemukan, 409 konflik bisnis/versi, 422 isian tidak valid, 429 batas login, 503 server sibuk. Error validasi dapat memiliki `details`. Tampilkan pesan tanpa membuang input pengguna. Untuk 500 catat `request_id`, jangan menampilkan SQL/internal error.
