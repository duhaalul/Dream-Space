# Modul Kasir

Pegangan kerja modul **Kasir dan Pembayaran** (SRS 4.3, 5.1). Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
Menerima pembayaran, menyelesaikan sesi, mencetak nota, mengembalikan kelebihan bayar, mengoreksi transaksi, dan menampilkan riwayat transaksi.
FR-06, FR-07, FR-09, FR-10, FR-12, FR-14 · UC-13 s.d. UC-15, UC-17 s.d. UC-20.

## Penanggung jawab
**Ihsan**

## Halaman & komponen
| File | Layar di Figma | Peran | Status |
|---|---|---|---|
| `pages/CashierPage.jsx` | Kasir (`UIUX/PNG/05_Kasir_Admin.png`): 3 kolom + tombol "+ Pelanggan Baru (Bayar Awal)" | Admin | Selesai |
| `components/ActiveVisitList.jsx` | kolom Pelanggan Aktif + pencarian nama/nomor antrean | Admin | Selesai |
| `components/BillDetails.jsx` | kolom Rincian Tagihan: item aktif, total, sudah dibayar, sisa/lunas/kelebihan, riwayat pembayaran | Admin | Selesai |
| `components/SessionAdjustments.jsx` | selama sesi foto: tambahan layanan (+/−) dan jumlah orang akhir | Admin | Selesai |
| `components/PaymentPanel.jsx` | kolom Pembayaran: Tunai/Transfer/QRIS, kembalian, refund kelebihan bayar, Selesaikan & Cetak Nota | Admin | Selesai |
| `cashier.js` | logika: label rincian, `canReceivePayment`, `finishBlocker`, peta error | — | Selesai |
| `pages/HistoryPage.jsx` | Riwayat (`UIUX/PNG/06_…`): filter tanggal, 4 kartu statistik, daftar, panel koreksi (Admin) | Admin; Owner lihat | Selesai |
| `components/HistoryList.jsx` | Daftar Transaksi Selesai & Dibatalkan + pencarian | Admin; Owner lihat | Selesai |
| `components/TransactionDetailModal.jsx` | detail transaksi, cetak ulang nota, riwayat koreksi | Admin; Owner lihat | Selesai |
| `components/CorrectionPanel.jsx` | Koreksi Data Transaksi: nama pelanggan, metode/referensi pembayaran + alasan | Admin | Selesai |
| `components/AuditList.jsx` | daftar koreksi (nilai lama → baru, alasan, waktu) | Admin; Owner lihat | Selesai |

Komponen dasar yang sudah tersedia (`@/shared/components/ui`, contoh di `/dev/komponen`):
- `Card`: tiga kolom Kasir;
- `SegmentedControl tone="brand"`: pilihan metode Tunai/Transfer/QRIS;
- `Button variant="primary"` (Terima Pembayaran) dan `variant="success"` (Selesaikan & Cetak Nota);
- `StatCard` + `Table`: ringkasan dan daftar di Riwayat;
- `Badge`: status bayar.

Route: `/kasir` = daftar pelanggan aktif; `/kasir/:id` = pelanggan (kunjungan) terpilih.

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Kasir: bayar, selesaikan sesi, refund, cetak nota | ✓ | — (tidak ada menu Kasir) |
| Riwayat: lihat, riwayat koreksi, cetak ulang nota | ✓ | ✓ |
| Riwayat: koreksi transaksi | ✓ | — |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `getActiveVisits(params)` | `GET /visits?history=false` | Kolom Pelanggan Aktif: `{ date, page, search }` |
| `getCashierDetail(visitId)` | `GET /visits/:id` | Rincian tagihan |
| `setTransactionAddons(trxId, data)` | `PUT /transactions/:id/addons` | Tambahan selama sesi: `{ version, addons: [{ addon_id, qty }], reason }` |
| `addPayment(trxId, data)` | `POST /transactions/:id/payments` | Terima pembayaran |
| `finishVisit(visitId, data)` | `POST /visits/:id/finish` | Selesaikan sesi (+ pembayaran/refund terakhir) |
| `addRefund(trxId, data)` | `POST /transactions/:id/refunds` | Kembalikan kelebihan bayar |
| `downloadReceipt(trxId)` | `GET /transactions/:id/receipt.pdf` | Nota PDF → `openBlob()` untuk mencetak |
| `getHistory(params)` | `GET /visits?history=true` | Riwayat: `{ page, search, from, to }`, maks. 100 per halaman |
| `addCorrection(trxId, data)` | `POST /transactions/:id/corrections` | Koreksi (Admin) |
| `getAudit(trxId)` | `GET /transactions/:id/audit` | Riwayat koreksi |

Data penting dari `getCashierDetail`:
- `balance = { paid, refunded, net, due, surplus }`: `due` = sisa tagihan, `surplus` = kelebihan bayar.
- `items` dengan `is_active = 1` = tagihan saat ini.
- Simpan `visit.version` dan `transaction.version` terbaru untuk request berikutnya.
- Reservasi yang belum memilih paket: `due = 0` **bukan** berarti lunas.

## Aturan wajib
- Pembayaran boleh di awal, berupa DP, atau sebagian. **Mulai foto** (di Antrean) hanya bisa jika tagihan awal lunas.
- Tambahan selama sesi (tambah waktu, tambah cetak) dicatat lalu dibayar di akhir.
- Tombol **"Selesaikan & Cetak Nota" nonaktif selama `balance.due > 0`** atau masih ada kelebihan bayar yang belum dikembalikan.
- `finishVisit` mengirim jumlah orang akhir dan **seluruh** tambahan (array kosong jika tidak ada). Prosesnya atomik: kalau saldo tidak pas, semuanya dibatalkan.
- Tunai: `amount` = uang yang diserahkan pelanggan; kembalian dihitung backend, tampilkan dari respons. Transfer/QRIS tidak boleh melebihi sisa tagihan.
- Metode: Tunai, Transfer, QRIS. Tulis **"QRIS"**, bukan "QRIS Dinamis".
- Refund hanya untuk kelebihan bayar (mis. ganti ke paket lebih murah). Pembatalan tidak mengembalikan uang.
- Pembayaran tidak bisa dihapus; salah input diperbaiki lewat koreksi. Koreksi transaksi yang sudah lunas wajib alasan. Transaksi batal hanya boleh dikoreksi nama/penerimaannya.
- Nota hanya ada setelah Selesai; cetak ulang dari Riwayat.
- `client_request_id = newRequestId()` sekali per pembayaran/refund; pakai ulang saat mencoba lagi.
- Selama sesi: tambahan layanan disimpan dengan `setTransactionAddons` (alasan otomatis "Tambahan layanan selama sesi"), jumlah orang akhir dengan `updateVisitSelection` dari modul antrean (paket & latar tetap). Lalu bayar sisa, baru "Selesaikan & Cetak Nota" (mengirim jumlah orang & tambahan yang sama → tidak perlu alasan).
- Reservasi yang belum datang: pembayaran otomatis bertipe **DP** (nontunai wajib referensi). Selain itu bertipe Pembayaran.
- Data Kasir (pelanggan, rincian, katalog paket/tambahan) diperbarui otomatis tiap 15 detik.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `UNSETTLED` | Masih ada sisa tagihan/kelebihan bayar saat menyelesaikan (seharusnya tombol sudah nonaktif) |
| `EXCESS_NONCASH` | Transfer/QRIS melebihi sisa tagihan |
| `INVALID_CASH` | Uang tunai kurang |
| `NO_OUTSTANDING` | Tidak ada sisa tagihan |
| `REFUND_EXCEEDS_SURPLUS`, `REFUND_NOT_ALLOWED` | Refund melebihi kelebihan bayar / tidak diizinkan |
| `REASON_REQUIRED` | Perubahan transaksi lunas wajib alasan |
| `INVALID_BALANCE`, `UNSETTLED_CORRECTION` | Koreksi membuat saldo tidak seimbang |
| `CANCELLED` | Transaksi batal hanya bisa dikoreksi nama/penerimaan |
| `TERMINAL_VISIT` | Kunjungan sudah berakhir |
| `RECEIPT_NOT_READY` | Nota baru ada setelah Selesai |
| `FUTURE_PAYMENT` | Tanggal penerimaan di masa depan |
| `REFERENCE_REQUIRED` | Pembayaran nontunai wajib referensi |
| `STALE_VERSION` | Data berubah di komputer lain: muat ulang, jangan kirim ulang otomatis |
| `IDEMPOTENCY_CONFLICT` | Request ID dipakai untuk data berbeda; isi ulang form |

## Hubungan dengan modul lain
- **Dari `antrean`:** tombol "Selesaikan sesi" dan penolakan "Mulai foto" membuka `/kasir/:id` (`id` = id kunjungan). Jangan ubah format alamat ini tanpa koordinasi.
- **Memakai dari `paket`:** `getAddons()` dan `getPackages()` (`@/modules/paket/api`) untuk pilihan tambahan dan ganti paket.

## Checklist selesai
- [x] Kolom pelanggan aktif + pencarian, klik → `/kasir/:id`
- [x] Rincian tagihan (item, tambahan, total, sudah bayar, sisa)
- [x] Form pembayaran Tunai/Transfer/QRIS + kembalian
- [x] Konfirmasi akhir sesi (jumlah orang akhir + tambahan)
- [x] "Selesaikan & Cetak Nota" nonaktif selama ada sisa tagihan; nota terbuka setelah selesai
- [x] Refund kelebihan bayar
- [x] Riwayat + pencarian + cetak ulang nota
- [x] Panel koreksi (Admin) + riwayat koreksi (Admin & Owner)
- [x] Tombol bayar/simpan memakai `loading` (anti klik ganda)
- [x] `npm run build` dan `npm run lint` lulus
- [ ] Semua langkah uji di bawah lulus

## Cara mengetes
1. Paket Rp100.000, bayar Tunai Rp150.000 → kembalian Rp50.000.
2. Mulai foto (di Antrean) → tambah waktu Rp20.000 → tombol Selesaikan nonaktif → bayar Rp20.000 → tombol aktif → selesai dan nota terbuka.
3. Transfer melebihi sisa tagihan → ditolak.
4. Setelah lunas dan sebelum dipanggil, ganti ke paket lebih murah → Mulai foto ditolak karena ada kelebihan bayar → refund kelebihan bayar → Mulai foto berhasil.
5. Riwayat: koreksi metode bayar dengan alasan → riwayat koreksi bertambah. Login Owner → riwayat koreksi terlihat, tombol koreksi tidak ada.
6. Cetak ulang nota dari Riwayat.
7. Tekan Bayar dua kali dengan cepat → hanya 1 pembayaran tercatat.

## Keterbatasan saat ini
- Koreksi di Riwayat hanya untuk **nama pelanggan** dan **metode/referensi pembayaran** (nominal & waktu tetap). Koreksi nominal/harga rincian belum dibuat karena bisa membuat saldo transaksi selesai tidak pas (backend: `UNSETTLED_CORRECTION`).
- Jumlah "Koreksi Data" dihitung dari audit tiap transaksi yang tampil (backend belum punya daftar audit global).
