# Modul Pendaftaran & Riwayat (folder `kasir`)

Pegangan kerja menu **Pendaftaran** (tab **Di Tempat** dan **Reservasi**) dan **Riwayat**. Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
- **Di Tempat:** pelanggan di studio memilih paket, latar, jumlah orang, dan tambahan, lalu **membayar lunas** dan langsung masuk antrean. Nota tercetak setelah bayar.
- **Reservasi:** pesanan lewat WhatsApp dicatat dengan **paket (wajib)**, tanggal & jam (tidak boleh bentrok di paket yang sama), dan **DP atau Lunas** lewat Transfer/QRIS. Pelanggan muncul di Antrean › **Reservasi**, lalu masuk antrean lewat **Sudah Datang**.
- **Riwayat:** daftar sesi yang sudah berakhir (Selesai & Dibatalkan) pada **satu tanggal** (Admin & Owner bebas memilih tanggal), detail transaksi, dan cetak ulang nota. Uang penjualan dilihat di menu **Laporan** (Admin: hari ini).
  - Reservasi yang **dibatalkan sebelum datang** tampil pada **tanggal pembatalannya** (bukan tanggal reservasinya), dengan keterangan "Jadwal 25 Nov 14.00". Jadi reservasi untuk tanggal mendatang yang dibatalkan hari ini terlihat di Riwayat hari ini.

## Penanggung jawab
**Ihsan**

## Alur Di Tempat
1. Admin mengisi data pelanggan dan memilih tambahan (tambah waktu/cetak) di kiri, lalu metode dan nominal pembayaran di kanan.
2. **Konfirmasi & Masuk Antrean** → satu permintaan ke backend: kunjungan dibuat, tambahan dicatat, pembayaran diterima. Kalau tidak lunas, semuanya dibatalkan.
3. Muncul **pop-up Berhasil**: nomor antrean besar (`RG-001`), Lunas, Kembalian, tombol **Cetak Nota** (nota tidak terbuka otomatis) dan **Pendaftaran Baru**. Pembayarannya langsung masuk Laporan sebagai baris **Lunas** (penjualan = uang masuk per pembayaran).
4. Di Antrean: Panggil → Mulai Foto → **Selesai**. Sesi masuk Riwayat.

## Alur Reservasi
1. Tab **Reservasi** (kanan atas, tersimpan di URL `?tab=reservasi`).
2. Kiri **Pelanggan**:
   - Nama panggilan *, No. WhatsApp (opsional, 8–15 angka; **hanya angka**: huruf, spasi, tanda hubung dibuang saat diketik/ditempel);
   - semua baris memakai lajur yang sama dengan Paket | Latar | Jumlah Orang (`PACKAGE_GRID`): Nama & Tanggal selebar Paket, No. WA & Jam selebar Latar + Jumlah Orang;
   - Paket * / Latar * / Jumlah Orang *, Tambahan;
   - Tanggal * + Jam (WIB) *: pilihan jam **dari backend** (`useReservationSlots` → `GET /reservations/availability`): per 15 menit 13.15–20.45, belum lewat, dan **tidak bentrok** dengan reservasi lain di paket yang sama. Lama pemakaian = durasi paket (kosong → 15 menit) + tambah waktu. Jam nonaktif "Pilih paket dulu" sebelum paket dipilih; jam yang jadi bentrok (mis. tambah waktu ditambah) ditandai "(terisi)".
3. Kanan **Pembayaran** (wajib):
   - **DP**: nominal diketik Admin, harus < total (dicek langsung); baris "Sisa saat datang";
   - **Lunas**: nominal otomatis = total (hanya baca);
   - Metode **Transfer/QRIS** saja; Referensi opsional (Transfer).
4. **Simpan Reservasi** → pop-up **Reservasi Tersimpan**: jam besar, tanggal, paket, "DP · metode"/"Lunas · metode", Sisa; **Cetak Nota** hanya bila lunas; **Reservasi Baru**.
5. Sebelum datang, reservasi bisa diubah lewat Antrean › Detail › **Ubah Reservasi** (paket, tambahan, jadwal, nama, WA). Lebih mahal → sisa dibayar saat datang; lebih murah dari yang sudah dibayar → kelebihan **dikembalikan** (Tunai/Transfer).
6. Saat pelanggan datang → Antrean › Reservasi › **Sudah Datang** (lihat [README antrean](../antrean/README.md)): tambahan boleh ditambah, bayar sisa, nomor `RG-R001`, urutan sesuai jam reservasi.

Kedua tab tetap terpasang (yang tidak aktif disembunyikan), jadi isian tidak hilang saat pindah tab.
Setelah masuk antrean (Di Tempat lunas saat daftar, reservasi setelah Sudah Datang), paket dan tambahan **tidak bisa diubah** (backend: `PAID_LOCKED`); nanti lewat fitur koreksi.

## Halaman & komponen
| File | Isi | Peran |
|---|---|---|
| `pages/RegistrationPage.jsx` | `/pendaftaran`: judul + tab Di Tempat/Reservasi (`SegmentedControl` berikon); memuat katalog | Admin |
| `components/WalkInForm.jsx` | tab Di Tempat: kartu Pelanggan (kiri) + Pembayaran (kanan), pop-up Berhasil | Admin |
| `components/ReservationForm.jsx` | tab Reservasi: isian (`ReservationFields`) + DP/Lunas; pop-up Reservasi Tersimpan | Admin |
| `components/ReservationFields.jsx` | isian reservasi: Nama, WA, Paket/Latar/Orang, Tambahan, chip, Tanggal + Jam (dipakai juga pop-up Ubah Reservasi) | Admin |
| `components/BillSummary.jsx` | rincian + Total (+ "Sudah dibayar" & sisa bila ada uang masuk; label sisa lewat `dueLabel`); `SummaryRow` | — |
| `components/PaymentFields.jsx` | Metode, Uang diterima (cek langsung "Kurang RpX") / Nominal, Referensi, Kembalian | Admin |
| `components/RegistrationSuccess.jsx` | pop-up Berhasil: nomor antrean, Lunas, Kembalian, Cetak Nota (Di Tempat & Sudah Datang) | Admin |
| `components/AddonPicker.jsx` | tambahan yang diizinkan paket (+/−); `min` = jumlah minimum per tambahan (Sudah Datang) | Admin |
| `components/PackageSummary.jsx` | chip kapasitas · durasi (· urutan · ruangan bila ada `data`); `Chip` | Admin |
| `pages/HistoryPage.jsx` | `/riwayat`: pilihan satu Tanggal, 3 kartu (Total Sesi, Selesai, Dibatalkan), daftar | Admin & Owner |
| `components/HistoryList.jsx` | daftar sesi + pencarian (nomor, nama, paket, no. transaksi); kolom Nominal & Status selebar tetap (angka dan badge lurus); reservasi batal sebelum datang: "Paket · Jadwal 25 Nov 14.00" | Admin & Owner |
| `components/TransactionDetailModal.jsx` | rincian, **Total = harga semua layanan**, pembayaran ("DP · metode"), **dikembalikan** (refund), kembalian (bila > 0), **Uang ditahan (batal)** untuk kunjungan batal, waktu lunas & Cetak Ulang Nota (hanya bila lunas penuh / Selesai), alasan batal | Admin & Owner |
| `useCatalog.js` | katalog paket + tambahan untuk form (dipakai juga pop-up Sudah Datang & Ubah Reservasi) | — |
| `useReservationSlots.js` | `useReservationSlots` (pilihan jam dari backend) + `useReservationTime` (opsi Jam, placeholder, "(terisi)"; saat ubah, jam semula tetap bisa dipilih) | — |
| `reservation.js` | `normalizePhone`, `validPhone`, `liveReservationErrors`, `validateReservation`, `reservationPayload` (form Reservasi & Ubah Reservasi) | — |
| `cashier.js` | `PAYMENT_METHODS`, `RESERVATION_METHODS`, `bookingMinutes`, `billPreview`, `editBillPreview` (paket sama → harga saat reservasi), `billFromDetail`, `itemsTotal`, `fullyPaid` (lunas penuh, sama dengan syarat nota backend), `cashError`, `paymentPayload`, `successInfo`, `activeItems`, `itemLabel`, `totalChange`, `methodLabel` | — |

Dipakai ulang dari `antrean`: `PackageFields`, `useDayVisits`, `packageQueue`, `queueLabel`, `interpretSaveError`.

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Pendaftaran Di Tempat & Reservasi | ✓ | — (tidak ada menu) |
| Riwayat: lihat (tanggal mana pun), detail, cetak ulang nota | ✓ | ✓ |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `registerWalkIn(data)` | `POST /visits/walk-in` | Di Tempat: daftar + tambahan + bayar lunas (atomik) |
| `registerReservation(data)` | `POST /visits/reservation` | Reservasi: paket + jadwal + tambahan + DP/LUNAS (atomik; `RESERVATION_CLASH` bila bentrok) |
| `getReservationSlots(params)` | `GET /reservations/availability` | Pilihan jam: `{ date, package_id, minutes }` (+ `visit_id` saat ubah) → `{ slots }` |
| `checkInReservation(id, data)` | `POST /visits/:id/check-in` | Sudah Datang, termasuk tambahan baru (dipakai `antrean/components/CheckInModal`) |
| `updateReservation(id, data)` | `PUT /visits/:id/reservation` | Ubah Reservasi + refund kelebihan bayar (dipakai `antrean/components/ReservationEditModal`) |
| `getTransactionDetail(visitId)` | `GET /visits/:id` | Detail di Riwayat |
| `getHistory(params)` | `GET /visits?history=true` | Riwayat: `{ date, page }`, maks. 100 per halaman |
| `downloadReceipt(trxId)` | `GET /transactions/:id/receipt.pdf` | Nota PDF → `openBlob()` |
| `addPayment(trxId, data)` | `POST /transactions/:id/payments` | Belum dipakai |

Body `registerWalkIn`:
```js
{
  client_request_id, customer_name, package_id, background_id, persons,
  addons: [{ addon_id, qty }],
  payment: { client_request_id, method: 'TUNAI' | 'TRANSFER' | 'QRIS', amount, reference },
}
```

Body `registerReservation`:
```js
{
  client_request_id, customer_name, phone, appointment_at: 'YYYY-MM-DD HH:mm:00',
  package_id, background_id, persons, // wajib
  addons: [{ addon_id, qty }],
  payment: { client_request_id, type: 'DP' | 'LUNAS', method: 'TRANSFER' | 'QRIS', amount, reference },
}
```

Body `updateReservation` (seluruh isian akhir; `refund` dikirim bila sudah ada uang masuk, dipakai backend hanya bila ada kelebihan):
```js
{
  version, customer_name, phone, appointment_at: 'YYYY-MM-DD HH:mm:00',
  package_id, background_id, persons, addons: [{ addon_id, qty }],
  refund: { client_request_id, method: 'TUNAI' | 'TRANSFER' },
}
```

## Aturan wajib
- **Tunai:** `amount` = uang yang diterima (≥ sisa); kembalian dihitung backend.
- **Transfer/QRIS:** nominal otomatis = sisa tagihan, kembalian Rp0.
- **Referensi** hanya muncul untuk Transfer (opsional).
- Metode ditulis **"QRIS"**, bukan "QRIS Dinamis".
- Total di form hanya perkiraan; total resmi dari backend.
- `client_request_id` dibuat sekali per pengisian form dan dipakai ulang saat mencoba lagi, supaya klik ganda tetap 1 transaksi.
- Jumlah orang, uang tunai, nominal DP, dan No. WhatsApp dicek **langsung saat diketik**.
- Nota tersedia sejak lunas: dicetak dari pop-up, lalu bisa dicetak ulang dari Antrean (Detail) atau Riwayat.
- Pembatalan tidak mengembalikan uang (DP maupun reservasi lunas). Uang hanya dikembalikan saat **Ubah Reservasi** membuat total lebih kecil dari yang sudah dibayar.
- "Lunas" dibaca dari `transaction.payment_status`, bukan `paid_off_at` (tetap terisi walau paket dinaikkan setelah lunas).
- Kunjungan **batal**: backend mengganti `transaction.total` menjadi uang yang ditahan. Di Riwayat, Total tetap harga layanan (dari rincian), uang yang ditahan tampil di baris "Uang ditahan (batal)".
- **Lunas penuh** (`fullyPaid`) = `paid_off_at` terisi dan uang bersih ≥ harga semua layanan. Dipakai untuk baris "Lunas" dan Cetak Ulang Nota di Riwayat, sama dengan syarat nota di backend.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `PAYMENT_NOT_SETTLED`, `PAYMENT_REQUIRED`, `INVALID_CASH`, `DP_TOO_LARGE` | Nominal salah; tandai kolom nominal |
| `PACKAGE_REQUIRED`, `PERSONS_LIMIT`, `BACKGROUND_REQUIRED`, `BACKGROUND_CAPACITY`, `PACKAGE_INACTIVE`, `DP_EXCEEDS_TOTAL` | Isian paket/latar/jumlah orang salah; tandai kolomnya |
| `APPOINTMENT_INVALID`, `PAST_APPOINTMENT`, `RESERVATION_CLASH` | Jam/tanggal reservasi salah atau bentrok; tandai kolomnya |
| `IDEMPOTENCY_CONFLICT` | Request ID dipakai untuk data berbeda; isi ulang form |
| `RECEIPT_NOT_READY` | Nota belum ada (transaksi belum lunas) |

## Cara mengetes
1. Di Tempat: pilih paket → chip kapasitas, durasi, urutan, ruangan tampil; tambah waktu 2 → durasi & total naik. Jumlah orang melebihi kapasitas → pesan langsung. Tunai kurang → "Kurang RpX"; lebih → kembalian benar.
2. Konfirmasi → pop-up Berhasil (nomor `RG-00x`, kembalian) → Cetak Nota → Pendaftaran Baru → form kosong; pelanggan muncul di Antrean. Klik Konfirmasi dua kali cepat → hanya 1 transaksi.
3. Tab Reservasi: sebelum pilih paket → Lunas & Jam nonaktif; metode hanya Transfer/QRIS. Paket + DP → tersimpan, tanpa Cetak Nota.
4. Reservasi kedua di paket yang sama & hari yang sama → jam yang tumpang-tindih tidak muncul (paket 20 menit di 14.00 → 14.15 hilang, 14.30 ada).
5. Paket + DP ≥ total → pesan "DP harus kurang dari total… Pilih Lunas". Pilih Lunas → nominal = total → simpan → Cetak Nota tersedia.
6. Reservasi muncul di Antrean › Reservasi pada tanggalnya; Sudah Datang → bayar sisa → nomor `RG-R00x`.
7. Ubah Reservasi yang lunas ke harga lebih murah → Simpan dengan "Dikembalikan lewat" → Riwayat/Detail menampilkan "Dikembalikan · metode −RpX".
8. Riwayat: pilihan satu tanggal (Admin & Owner), 3 kartu tanpa total uang.
9. Login Owner → tidak ada menu Pendaftaran.

Uji otomatis UI: `tools/ui-test/uji-reservasi.mjs` dan `uji-riwayat-laporan.mjs` (di luar repo).

## Belum dibuat / ditunda
- **Koreksi** transaksi setelah masuk antrean (ganti paket/tambahan, koreksi nama, salah metode bayar): endpoint backend ada, tampilan belum. Refund di luar Ubah Reservasi juga belum ada di tampilan.
- Aturan DP otomatis (mis. persentase dari harga): sekarang nominal DP diketik Admin.
