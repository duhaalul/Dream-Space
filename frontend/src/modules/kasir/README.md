# Modul Pendaftaran & Riwayat (folder `kasir`)

Pegangan kerja menu **Pendaftaran** (daftar + bayar lunas di awal) dan **Riwayat**. Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
- **Pendaftaran:** pelanggan datang langsung memilih paket, latar, jumlah orang, dan tambahan, lalu **membayar lunas** dan langsung masuk antrean. Nota tercetak setelah bayar.
- **Riwayat:** daftar sesi yang sudah berakhir (Selesai & Dibatalkan), detail transaksi, dan cetak ulang nota.

## Penanggung jawab
**Ihsan**

## Alur datang langsung
1. Admin mengisi data pelanggan dan memilih tambahan (tambah waktu/cetak) di kiri, lalu memilih metode dan nominal pembayaran di kanan.
2. **Konfirmasi & Masuk Antrean** → satu permintaan ke backend: kunjungan dibuat, tambahan dicatat, pembayaran diterima. Kalau tidak lunas, semuanya dibatalkan.
3. Muncul **pop-up Berhasil**: nomor antrean besar, Lunas, Kembalian, tombol **Cetak Nota** (nota tidak terbuka otomatis) dan **Pendaftaran Baru**. Penjualan dihitung **saat lunas**.
4. Di Antrean: Panggil → Mulai Foto → **Selesai**. Sesi masuk Riwayat.

Setelah lunas, paket dan tambahan **tidak bisa diubah** (backend: `PAID_LOCKED`); nanti lewat fitur koreksi.

## Halaman & komponen
| File | Isi | Peran |
|---|---|---|
| `pages/RegistrationPage.jsx` | `/pendaftaran`: kartu Pelanggan (kiri) + Pembayaran (kanan); jumlah orang & uang tunai dicek langsung saat diketik; pop-up Berhasil + Cetak Nota | Admin |
| `components/AddonPicker.jsx` | tambahan yang diizinkan paket (+/−) | Admin |
| `components/PackageSummary.jsx` | satu baris chip setelah paket dipilih: kapasitas · durasi (paket + tambah waktu) · Urutan ke-N · kondisi ruangan | Admin |
| `pages/HistoryPage.jsx` | `/riwayat`: filter tanggal, 3 kartu (Total Sesi, Selesai, Dibatalkan), daftar | Admin & Owner |
| `components/HistoryList.jsx` | daftar sesi + pencarian (nomor, nama, paket, no. transaksi) | Admin & Owner |
| `components/TransactionDetailModal.jsx` | rincian, total, pembayaran, kembalian, waktu lunas, alasan batal, Cetak Ulang Nota | Admin & Owner |
| `cashier.js` | `PAYMENT_METHODS`, `billPreview` (perkiraan tagihan), `activeItems`, `itemLabel`, `totalChange`, `methodLabel` | — |

Dipakai ulang dari `antrean`: `PackageFields`, `useDayVisits`, `packageQueue`, `queueLabel`, `interpretSaveError`.

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Pendaftaran + pembayaran | ✓ | — (tidak ada menu) |
| Riwayat: lihat, detail, cetak ulang nota | ✓ | ✓ |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `registerWalkIn(data)` | `POST /visits/walk-in` | Daftar + tambahan + bayar lunas (atomik) |
| `getTransactionDetail(visitId)` | `GET /visits/:id` | Detail di Riwayat |
| `getHistory(params)` | `GET /visits?history=true` | Riwayat: `{ page, search, from, to }`, maks. 100 per halaman |
| `downloadReceipt(trxId)` | `GET /transactions/:id/receipt.pdf` | Nota PDF → `openBlob()` |
| `addPayment(trxId, data)` | `POST /transactions/:id/payments` | Belum dipakai (untuk pelunasan reservasi nanti) |

Body `registerWalkIn`:
```js
{
  client_request_id, customer_name, package_id, background_id, persons,
  addons: [{ addon_id, qty }],
  payment: { client_request_id, method: 'TUNAI' | 'TRANSFER' | 'QRIS', amount, reference },
}
```

## Aturan wajib
- **Tunai:** `amount` = uang yang diterima (≥ total); kembalian dihitung backend.
- **Transfer/QRIS:** nominal otomatis = total, kembalian Rp0.
- **Referensi** hanya muncul untuk Transfer (opsional).
- Metode ditulis **"QRIS"**, bukan "QRIS Dinamis".
- Total di form hanya perkiraan; total resmi dari backend.
- `client_request_id` dibuat sekali per pengisian form dan dipakai ulang saat mencoba lagi, supaya klik ganda tetap 1 transaksi.
- Jumlah orang (batas paket & latar) dan uang tunai ("Kurang RpX") dicek **langsung saat diketik**, tanpa menunggu Konfirmasi.
- Nota tersedia sejak lunas: dicetak dari pop-up Berhasil, lalu bisa dicetak ulang dari Antrean (Detail) atau Riwayat.
- Pembatalan tidak mengembalikan uang.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `PAYMENT_NOT_SETTLED`, `PAYMENT_REQUIRED`, `INVALID_CASH` | Nominal kurang; tandai kolom nominal |
| `PACKAGE_REQUIRED`, `PERSONS_LIMIT`, `BACKGROUND_REQUIRED`, `BACKGROUND_CAPACITY`, `PACKAGE_INACTIVE` | Isian paket/latar/jumlah orang salah; tandai kolomnya |
| `IDEMPOTENCY_CONFLICT` | Request ID dipakai untuk data berbeda; isi ulang form |
| `RECEIPT_NOT_READY` | Nota belum ada (transaksi belum lunas) |

## Cara mengetes
1. Pilih RG → chip kapasitas, durasi, urutan, ruangan tampil; tambah waktu 2 → durasi & total ikut naik. Jumlah orang melebihi kapasitas → pesan langsung muncul. Tunai kurang → "Kurang RpX" langsung muncul; Tunai lebih → kembalian benar.
2. Transfer → nominal = total, kolom referensi muncul; QRIS → tanpa referensi.
3. Konfirmasi → pop-up Berhasil (nomor antrean, kembalian), nota belum terbuka → Cetak Nota → nota terbuka → Pendaftaran Baru → form kosong; pelanggan muncul di Antrean.
4. Klik Konfirmasi dua kali cepat → hanya 1 transaksi. Setelah Pendaftaran Baru, pilih paket yang sama → urutan langsung naik 1 (data antrean dimuat ulang setelah daftar).
5. Antrean: Panggil → Mulai Foto → Selesai → muncul di Riwayat; detail menampilkan pembayaran dan bisa cetak ulang nota.
6. Batalkan kunjungan → Riwayat menampilkan alasan batal.
7. Login Owner → tidak ada menu Pendaftaran; Riwayat bisa dilihat.

## Belum dibuat / ditunda
- **Reservasi** (DP lalu pelunasan): tampilan disembunyikan; kode backend & `ReservationForm.jsx` disimpan.
- **Koreksi** transaksi dan **refund**: dihapus dari tampilan (endpoint backend masih ada).
